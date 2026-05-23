import { publicAssetUrl } from './publicAsset';

export type GhostDriveManifest = Record<string, string>;

export function normalizeGhostFileName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

export function toDriveDownloadUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    parsedUrl = null;
  }

  if (parsedUrl && /(^|\.)drive\.google\.com$/i.test(parsedUrl.hostname)) {
    const existingId = parsedUrl.searchParams.get('id');
    const resourceKey = parsedUrl.searchParams.get('resourcekey');
    const pathId = parsedUrl.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i)?.[1];
    const fileId = pathId || existingId;

    if (!fileId) return null;

    const downloadUrl = new URL('https://drive.google.com/uc');
    downloadUrl.searchParams.set('export', 'download');
    downloadUrl.searchParams.set('id', fileId);
    if (resourceKey) downloadUrl.searchParams.set('resourcekey', resourceKey);
    return downloadUrl.href;
  }

  const fileIdMatch =
    (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) ? ['', trimmed] : null);

  const fileId = fileIdMatch?.[1];
  if (!fileId) return null;

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function lookupManifestUrl(manifest: GhostDriveManifest, fileName: string) {
  const candidates = [
    fileName.trim().toLowerCase(),
    normalizeGhostFileName(fileName),
    fileName.trim().toLowerCase().replace(/\s+/g, ' '),
  ];

  for (const key of candidates) {
    if (manifest[key]) return manifest[key];
  }

  const normalizedTarget = normalizeGhostFileName(fileName);
  for (const [key, url] of Object.entries(manifest)) {
    if (normalizeGhostFileName(key) === normalizedTarget) return url;
  }

  return null;
}

let manifestPromise: Promise<GhostDriveManifest> | null = null;

export function loadGhostDriveManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(publicAssetUrl('ghost-drive-manifest.json'), { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}))
      .then((manifest) => manifest as GhostDriveManifest);
  }

  return manifestPromise;
}
