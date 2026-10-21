// Refreshes the CleanYourTV numbers in README.md between the STATS markers.
// Sources: GitHub API (stars, forks, contributors, merged PRs), the CleanYourTV
// README card text (models, brands, languages, launcher size) and docs/PRESS.md
// (article and country counts). If a source can't be read, the script fails and
// the README is left untouched.
import { readFile, writeFile } from 'node:fs/promises';

const REPO = 'Gathin23/cleanyourtv';
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'gathin23-profile-readme',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${path} returned ${res.status}`);
  return res;
}

async function raw(file) {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${file}`);
  if (!res.ok) throw new Error(`${file} returned ${res.status}`);
  return res.text();
}

function match(text, re, label) {
  const m = text.match(re);
  if (!m) throw new Error(`Could not find ${label}`);
  return m;
}

// 16094 -> "16,000+", 1764 -> "1,700+", 205 -> "200+", 7 -> "7"
function rounded(n) {
  const step = n >= 10000 ? 1000 : n >= 1000 ? 100 : n >= 100 ? 10 : 1;
  const floored = Math.floor(n / step) * step;
  return step === 1 ? n.toLocaleString('en-US') : `${floored.toLocaleString('en-US')}+`;
}

const repo = await (await api(`/repos/${REPO}`)).json();

const contribRes = await api(`/repos/${REPO}/contributors?per_page=1`);
const last = (contribRes.headers.get('link') || '').match(/[?&]page=(\d+)>; rel="last"/);
const contributors = last ? Number(last[1]) : (await contribRes.json()).length;

const merged = (await (await api(`/search/issues?q=repo:${REPO}+is:pr+is:merged&per_page=1`)).json()).total_count;

const projectReadme = await raw('README.md');
const [, models, brands, languages, launcherKb] = match(
  projectReadme,
  /(\d[\d,]*) TV models · (\d[\d,]*) brands · (\d[\d,]*) languages · (\d[\d,]*) KB launcher/,
  'TV model stats in the CleanYourTV README',
);

const press = await raw('docs/PRESS.md');
const [, articles] = match(press, /\*\*(\d[\d,]*) articles\*\*/, 'article count in PRESS.md');
const [, countries] = match(press, /in (\d[\d,]*) countries/, 'country count in PRESS.md');

const block = [
  '<!-- STATS:START -->',
  `- **${rounded(repo.stargazers_count)} stars, ${rounded(repo.forks_count)} forks, ${rounded(contributors)} contributors and ${rounded(merged)} merged PRs**, all since the repo went up on 17 October 2026.`,
  `- **${articles} articles from ${countries} countries**, including [TechCrunch](https://techcrunch.com/2026/10/19/people-are-using-ai-to-make-their-smart-tvs-dumb-again/), [Mashable](https://mashable.com/tech/smart-tv-ads-claude-code-ai-cleanup), [TechRadar](https://www.techradar.com/entertainment/streaming/your-tv-should-do-what-you-paid-for-people-are-vibe-coding-apps-to-banish-ads-from-their-smart-tvs-and-android-tv-and-its-catching-on), [Tom's Guide](https://www.tomsguide.com/ai/people-are-using-ai-to-turn-their-smart-tvs-into-dumb-tvs-and-you-might-want-to-do-the-same), [Android Authority](https://www.androidauthority.com/android-tv-vibe-hacking-remove-ads-bloatware-3725338/) and [XDA](https://www.xda-developers.com/people-are-now-vibe-coding-their-smart-tvs-to-strip-them-of-ads-and-unwanted-features/). [Full press list](https://github.com/${REPO}/blob/main/docs/PRESS.md).`,
  `- **${models} TV models from ${brands} brands** tested by the community, and a ${launcherKb} KB launcher in ${languages} languages.`,
  '- Live on [Product Hunt](https://www.producthunt.com/products/cleanyourtv) and at [cleanyour.tv](https://cleanyour.tv).',
  '<!-- STATS:END -->',
].join('\n');

const readme = await readFile('README.md', 'utf8');
if (!/<!-- STATS:START -->[\s\S]*<!-- STATS:END -->/.test(readme)) throw new Error('STATS markers missing from README.md');
const updated = readme.replace(/<!-- STATS:START -->[\s\S]*<!-- STATS:END -->/, block);

if (updated === readme) {
  console.log('Stats unchanged');
} else {
  await writeFile('README.md', updated);
  console.log('README updated');
}
console.log(block);
