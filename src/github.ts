import type { GitHubRelease, WikiFile } from './types';

const OWNER = 'C0mposer';
const REPO = 'Spyro-1-Practice-Rom';
const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO}`;
const RAW_WIKI_ROOT = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/wiki/`;

export const LINKS = {
  repo: `https://github.com/${OWNER}/${REPO}`,
  wiki: `https://github.com/${OWNER}/${REPO}/wiki`,
  releases: `https://github.com/${OWNER}/${REPO}/releases`,
  sourceWiki: `https://github.com/${OWNER}/${REPO}/tree/main/wiki`,
  romPatcher: 'https://github.com/marcrobledo/RomPatcher.js',
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
  return readJson<GitHubRelease>(`${API_ROOT}/releases/latest`);
}

export async function getWikiFiles() {
  const files = await readJson<WikiFile[]>(`${API_ROOT}/contents/wiki?ref=main`);
  return files
    .filter((file) => file.type === 'file' && file.name.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
