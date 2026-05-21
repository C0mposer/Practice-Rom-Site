import type { GitHubRelease, WikiFile } from './types';

const OWNER = 'C0mposer';
const REPO = 'Spyro-1-Practice-Rom';
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO}`;
const RAW_WIKI_ROOT = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/wiki/`;
const REPO_BLOB_ROOT = `https://github.com/${OWNER}/${REPO}/blob/main/wiki/`;

const FALLBACK_WIKI_NAMES = [
  '01-getting-started.md',
  '02-hotkeys.md',
  '03-il-timer.md',
  '04-save-states.md',
  '05-level-select.md',
  '06-ghost-replay.md',
  '07-misc-settings.md',
  '08-visualizer-settings.md',
  '09-cosmetic-settings.md',
  '10-level-specific.md',
  '11-quality-of-life.md',
  '12-building.md',
  '13-platform-comparison.md',
  '14-nestor-skip-frame-data.md',
  'README.md',
];

const FALLBACK_WIKI_FILES: WikiFile[] = FALLBACK_WIKI_NAMES.map((name) => ({
  name,
  path: `wiki/${name}`,
  download_url: `${RAW_WIKI_ROOT}${name}`,
  html_url: `${REPO_BLOB_ROOT}${name}`,
  size: 0,
  type: 'file',
}));

const FALLBACK_RELEASE: GitHubRelease = {
  name: 'Full Release Version 4.1',
  tag_name: 'fullrelease4.1',
  html_url: `https://github.com/${OWNER}/${REPO}/releases/tag/fullrelease4.1`,
  published_at: '2025-05-06T07:33:15Z',
  body: '',
  assets: [
    {
      id: 252234310,
      name: 'Spyro.1.Practice.Rom.PS1.zip',
      size: 359510175,
      download_count: 0,
      browser_download_url: `https://github.com/${OWNER}/${REPO}/releases/download/fullrelease4.1/Spyro.1.Practice.Rom.PS1.zip`,
    },
    {
      id: 252240481,
      name: 'Spyro.1.Practice.Rom.PS2.Deckard.zip',
      size: 359512948,
      download_count: 0,
      browser_download_url: `https://github.com/${OWNER}/${REPO}/releases/download/fullrelease4.1/Spyro.1.Practice.Rom.PS2.Deckard.zip`,
    },
    {
      id: 252234384,
      name: 'Spyro.1.Practice.Rom.PS2.IOP.zip',
      size: 359510461,
      download_count: 0,
      browser_download_url: `https://github.com/${OWNER}/${REPO}/releases/download/fullrelease4.1/Spyro.1.Practice.Rom.PS2.IOP.zip`,
    },
  ],
};

export const LINKS = {
  repo: `https://github.com/${OWNER}/${REPO}`,
  wiki: `https://github.com/${OWNER}/${REPO}/wiki`,
  releases: `https://github.com/${OWNER}/${REPO}/releases`,
  sourceWiki: `https://github.com/${OWNER}/${REPO}/tree/main/wiki`,
  romPatcher: 'https://github.com/marcrobledo/RomPatcher.js',
  ghostToolDuckstation: 'https://github.com/C0mposer/Emulator-Ghost-Tool',
  ghostToolPs2: 'https://github.com/C0mposer/Ghost-Tool',
};

const FALLBACK_GHOST_TOOL_DUCKSTATION: GitHubRelease = {
  name: '1.0',
  tag_name: '1.0',
  html_url: `${LINKS.ghostToolDuckstation}/releases/tag/1.0`,
  published_at: '2026-05-21T00:00:00Z',
  body: '',
  assets: [
    {
      id: 0,
      name: 'ghost_tool.exe',
      size: 0,
      download_count: 0,
      browser_download_url: `${LINKS.ghostToolDuckstation}/releases/download/1.0/ghost_tool.exe`,
    },
  ],
};

const FALLBACK_GHOST_TOOL_PS2: GitHubRelease = {
  name: 'V1.0',
  tag_name: '1.0',
  html_url: `${LINKS.ghostToolPs2}/releases/tag/1.0`,
  published_at: '2026-05-20T00:00:00Z',
  body: '',
  assets: [
    {
      id: 0,
      name: 'ghost_tool.elf',
      size: 0,
      download_count: 0,
      browser_download_url: `${LINKS.ghostToolPs2}/releases/download/1.0/ghost_tool.elf`,
    },
  ],
};

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getLatestRelease() {
  try {
    return await readJson<GitHubRelease>(`${API_ROOT}/releases/latest`);
  } catch (error) {
    console.warn('Using bundled release fallback because GitHub API failed.', error);
    return FALLBACK_RELEASE;
  }
}

export async function getGhostToolDuckstationRelease() {
  return getRepoLatestRelease('Emulator-Ghost-Tool', FALLBACK_GHOST_TOOL_DUCKSTATION);
}

export async function getGhostToolPs2Release() {
  return getRepoLatestRelease('Ghost-Tool', FALLBACK_GHOST_TOOL_PS2);
}

async function getRepoLatestRelease(repo: string, fallback: GitHubRelease) {
  try {
    return await readJson<GitHubRelease>(`https://api.github.com/repos/${OWNER}/${repo}/releases/latest`);
  } catch (error) {
    console.warn(`Using bundled ${repo} release fallback because GitHub API failed.`, error);
    return fallback;
  }
}

export async function getWikiFiles() {
  try {
    const files = await readJson<WikiFile[]>(`${API_ROOT}/contents/wiki?ref=main`);
    return files
      .filter((file) => file.type === 'file' && file.name.toLowerCase().endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  } catch (error) {
    console.warn('Using bundled wiki file fallback because GitHub API failed.', error);
    return FALLBACK_WIKI_FILES;
  }
}

export async function getWikiMarkdown(file: WikiFile) {
  const response = await fetch(file.download_url);

  if (!response.ok) {
    throw new Error(`Wiki request failed: ${response.status}`);
  }

  return response.text();
}

export function resolveWikiAsset(href: string) {
  if (/^https?:\/\//i.test(href) || href.startsWith('#') || href.startsWith('data:')) {
    return href;
  }

  return new URL(href, RAW_WIKI_ROOT).href;
}

export function titleFromFileName(name: string) {
  return name
    .replace(/\.md$/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
