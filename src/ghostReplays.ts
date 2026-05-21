import { toDriveDownloadUrl } from './ghostDrive';
import { resolveGhostReplaySheetId } from './ghostSheetConfig';
import { fetchGhostSheetFileLinks, lookupSheetFileLink } from './ghostSheetLinks';
import { publicAssetUrl } from './publicAsset';

export type GhostReplayEntry = {
  level: string;
  name: string;
  time: string;
  description: string;
  fileName: string;
  downloadUrl: string | null;
  hasFile: boolean;
};

export type GhostReplayCategory = {
  name: string;
  progress: string | null;
  entries: GhostReplayEntry[];
};

type GvizCell = { v?: unknown; f?: string } | null;

const CATEGORY_NAMES = new Set(['120%', 'Any%', 'Vortex', 'Flights']);
const PROGRESS_PATTERN = /^\d+\s*\/\s*\d+/;

export function resolveSheetId() {
  return resolveGhostReplaySheetId(import.meta.env.VITE_GHOST_REPLAY_SHEET_ID as string | undefined);
}

function sheetId() {
  return resolveSheetId();
}

function sheetGid() {
  const raw = (import.meta.env.VITE_GHOST_REPLAY_SHEET_GID as string | undefined)?.trim();
  return raw || '0';
}

function gvizFetchUrl() {
  const id = sheetId();
  const gid = sheetGid();

  if (import.meta.env.DEV) {
    return `/api/ghost-sheet-gviz?gid=${encodeURIComponent(gid)}`;
  }

  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}`;
}

function fileBaseUrl() {
  const base = import.meta.env.VITE_GHOST_REPLAY_FILE_BASE_URL as string | undefined;
  return base?.trim().replace(/\/$/, '') || '';
}

function cellText(cell: GvizCell) {
  if (!cell) return '';
  if (cell.v != null && cell.v !== '') return String(cell.v).trim();
  return '';
}

function cellLink(cell: GvizCell) {
  if (!cell) return '';

  const value = cellText(cell);
  if (/^https?:\/\//i.test(value)) return value;

  const formula = cell.f?.trim() || '';
  const hyperlinkMatch = formula.match(/HYPERLINK\(\s*"([^"]+)"/i);
  if (hyperlinkMatch?.[1]) return hyperlinkMatch[1];

  return value;
}

function looksLikeFileName(value: string) {
  return /\.(bin|gci|srm|zip)$/i.test(value) || /^ghost_/i.test(value);
}

function resolveDownloadUrl(
  fileCell: GvizCell,
  descriptionCell: GvizCell,
  fileLinks: Record<string, string>,
) {
  const fileLink = cellLink(fileCell);
  const descriptionLink = cellLink(descriptionCell);

  for (const candidate of [fileLink, descriptionLink]) {
    if (!/^https?:\/\//i.test(candidate)) continue;
    const driveUrl = toDriveDownloadUrl(candidate);
    if (driveUrl) return driveUrl;
    return candidate;
  }

  const fileName = [fileLink, descriptionLink, cellText(fileCell), cellText(descriptionCell)].find((value) =>
    looksLikeFileName(value),
  );

  if (!fileName) return null;

  const linkedUrl = lookupSheetFileLink(fileLinks, fileName);
  if (linkedUrl) return linkedUrl;

  const base = fileBaseUrl();
  if (!base) return null;

  return `${base}/${encodeURIComponent(fileName)}`;
}

function isCategoryRow(level: string, progress: string) {
  return CATEGORY_NAMES.has(level) || (level.length > 0 && /%$/.test(level) && PROGRESS_PATTERN.test(progress));
}

function isHeaderRow(level: string) {
  return level.toLowerCase() === 'level';
}

function rowCells(cells: GvizCell[]) {
  return {
    level: cellText(cells[1]),
    name: cellText(cells[2]),
    time: cellText(cells[3]),
    description: cellText(cells[4]),
    fileCell: cells[5] ?? null,
    descriptionCell: cells[4] ?? null,
  };
}

export function parseGhostReplayTable(rows: { c: GvizCell[] }[], fileLinks: Record<string, string> = {}) {
  const categories: GhostReplayCategory[] = [];
  let current: GhostReplayCategory | null = null;

  for (const row of rows) {
    const cells = row.c ?? [];
    const { level, name, time, description, fileCell, descriptionCell } = rowCells(cells);

    if (!level) continue;

    if (isCategoryRow(level, name)) {
      current = {
        name: level,
        progress: name || null,
        entries: [],
      };
      categories.push(current);
      continue;
    }

    if (!current || isHeaderRow(level)) continue;

    const fileName = cellText(fileCell) || (looksLikeFileName(description) ? description : '');
    const downloadUrl = resolveDownloadUrl(fileCell, descriptionCell, fileLinks);
    const hasFile = Boolean(fileName || downloadUrl);

    if (!hasFile && !name && !time && !description) {
      current.entries.push({
        level,
        name: '',
        time: '',
        description: '',
        fileName: '',
        downloadUrl: null,
        hasFile: false,
      });
      continue;
    }

    if (!hasFile) continue;

    current.entries.push({
      level,
      name,
      time,
      description: looksLikeFileName(description) ? '' : description,
      fileName: fileName || cellText(fileCell),
      downloadUrl,
      hasFile: true,
    });
  }

  return categories;
}

export function parseGvizPayload(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Ghost replay sheet returned an unexpected response.');
  }

  const payload = JSON.parse(text.slice(start, end + 1)) as {
    status?: string;
    table?: { rows?: { c: GvizCell[] }[] };
  };

  if (payload.status !== 'ok' || !payload.table?.rows) {
    throw new Error('Ghost replay sheet could not be read.');
  }

  return payload.table.rows;
}

function applyFileLinksToCategories(categories: GhostReplayCategory[], fileLinks: Record<string, string>) {
  return categories.map((category) => ({
    ...category,
    entries: category.entries.map((entry) => {
      if (!entry.fileName) return entry;

      const downloadUrl = lookupSheetFileLink(fileLinks, entry.fileName) ?? entry.downloadUrl;
      return { ...entry, downloadUrl, hasFile: Boolean(entry.fileName || downloadUrl) };
    }),
  }));
}

async function loadCachedGhostReplayData() {
  const response = await fetch(publicAssetUrl('ghost-replay-data.json'), { cache: 'no-store' });
  if (!response.ok) return null;

  const data = (await response.json()) as GhostReplayCategory[];
  return Array.isArray(data) ? data : null;
}

export async function fetchGhostReplayCategories() {
  const fileLinks = await fetchGhostSheetFileLinks();

  try {
    const sheetResponse = await fetch(gvizFetchUrl(), { cache: 'no-store' });

    if (!sheetResponse.ok) {
      throw new Error(`Ghost replay sheet request failed (${sheetResponse.status}).`);
    }

    const rows = parseGvizPayload(await sheetResponse.text());
    const categories = parseGhostReplayTable(rows, fileLinks).filter(
      (category) => category.entries.length > 0,
    );

    if (categories.length === 0) {
      throw new Error('No ghost replay categories were found in the sheet.');
    }

    return categories;
  } catch (error) {
    const cached = await loadCachedGhostReplayData();
    if (cached?.length) {
      console.warn('Using cached ghost replay data because the live sheet request failed.', error);
      return applyFileLinksToCategories(cached, fileLinks).filter((category) => category.entries.length > 0);
    }

    throw error instanceof Error ? error : new Error('Ghost replay sheet could not be loaded.');
  }
}

export function countAvailableGhosts(categories: GhostReplayCategory[]) {
  return categories.reduce((sum, category) => sum + category.entries.filter((entry) => entry.hasFile).length, 0);
}

export function countDownloadableGhosts(categories: GhostReplayCategory[]) {
  return categories.reduce(
    (sum, category) => sum + category.entries.filter((entry) => entry.hasFile && entry.downloadUrl).length,
    0,
  );
}
