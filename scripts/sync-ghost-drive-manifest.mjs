import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }

  return env;
}

function extractFolderId(value) {
  const trimmed = value.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  if (folderMatch?.[1]) return folderMatch[1];
  return trimmed;
}

function addManifestKeys(manifest, fileName, url) {
  const base = fileName.trim();
  const lower = base.toLowerCase();
  manifest[lower] = url;
  manifest[lower.replace(/\s+/g, '_')] = url;
  manifest[lower.replace(/_/g, ' ')] = url;
}

async function listDriveFiles(folderId, apiKey) {
  const manifest = {};
  let pageToken;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name)',
      pageSize: '1000',
      key: apiKey,
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    if (!response.ok) {
      throw new Error(`Google Drive API failed (${response.status}): ${await response.text()}`);
    }

    const payload = await response.json();
    for (const file of payload.files ?? []) {
      const url = `https://drive.google.com/uc?export=download&id=${file.id}`;
      addManifestKeys(manifest, file.name, url);
    }

    pageToken = payload.nextPageToken;
  } while (pageToken);

  return manifest;
}

const env = {
  ...loadEnvFile(resolve('.env')),
  ...loadEnvFile(resolve('.env.local')),
};

const folderId = extractFolderId(
  env.GHOST_DRIVE_FOLDER_ID || env.VITE_GHOST_REPLAY_DRIVE_FOLDER_ID || '',
);
const apiKey = env.GOOGLE_API_KEY || env.VITE_GOOGLE_API_KEY || '';

if (!folderId || !apiKey) {
  console.error(
    'Set GHOST_DRIVE_FOLDER_ID (or VITE_GHOST_REPLAY_DRIVE_FOLDER_ID) and GOOGLE_API_KEY in .env.local',
  );
  process.exit(1);
}

const manifest = await listDriveFiles(folderId, apiKey);
const outputPath = resolve('public/ghost-drive-manifest.json');

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${Object.keys(manifest).length} manifest keys to ${outputPath}`);
