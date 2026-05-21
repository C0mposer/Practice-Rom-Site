import JSZip from 'jszip';
import { resolveGhostReplaySheetId } from './ghostSheetConfig';
import { loadGhostDriveManifest, normalizeGhostFileName, toDriveDownloadUrl } from './ghostDrive';

function sheetId() {
  return resolveGhostReplaySheetId(import.meta.env.VITE_GHOST_REPLAY_SHEET_ID as string | undefined);
}

function xlsxExportUrl() {
  if (import.meta.env.DEV) {
    return '/api/ghost-sheet-export';
  }

  return `https://docs.google.com/spreadsheets/d/${sheetId()}/export?format=xlsx`;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function parseSharedStrings(xml: string) {
  const strings: string[] = [];

  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const text = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((part) => decodeXml(part[1]))
      .join('');
    strings.push(text);
  }

  return strings;
}

function parseHyperlinkRelationships(xml: string) {
  const relationships: Record<string, string> = {};

  for (const match of xml.matchAll(
    /<Relationship Id="([^"]+)"[^>]*Type="[^"]*hyperlink"[^>]*Target="([^"]+)"/g,
  )) {
    relationships[match[1]] = decodeXml(match[2]);
  }

  return relationships;
}

function readCellLabel(cellXml: string, sharedStrings: string[]) {
  const formulaMatch = cellXml.match(/<f[^>]*>([\s\S]*?)<\/f>/);
  if (formulaMatch) {
    const formula = decodeXml(formulaMatch[1]);
    const hyperlinkMatch = formula.match(/HYPERLINK\(\s*"([^"]+)"/i);
    if (hyperlinkMatch?.[1]) return { label: '', url: hyperlinkMatch[1] };
  }

  const valueMatch = cellXml.match(/<v>([^<]*)<\/v>/);
  if (!valueMatch) return { label: '', url: '' };

  const rawValue = decodeXml(valueMatch[1]);
  if (cellXml.includes('t="s"') || /^\d+$/.test(rawValue)) {
    return { label: sharedStrings[Number(rawValue)] || rawValue, url: '' };
  }

  return { label: rawValue, url: '' };
}

function parseSheetFileLinks(sheetXml: string, relationships: Record<string, string>, sharedStrings: string[]) {
  const links: Record<string, string> = {};

  const patterns: Array<{ regex: RegExp; idIndex: number; refIndex: number }> = [
    { regex: /<hyperlink[^>]*r:id="([^"]+)"[^>]*ref="([^"]+)"/g, idIndex: 1, refIndex: 2 },
    { regex: /<hyperlink[^>]*ref="([^"]+)"[^>]*r:id="([^"]+)"/g, idIndex: 2, refIndex: 1 },
  ];

  for (const { regex, idIndex, refIndex } of patterns) {
    for (const match of sheetXml.matchAll(regex)) {
      const relationshipId = match[idIndex];
      const cellRef = match[refIndex];
      if (!cellRef.startsWith('F')) continue;

      const relationshipUrl = relationships[relationshipId];
      if (!relationshipUrl) continue;

      const cellMatch = sheetXml.match(new RegExp(`<c r="${cellRef}"[^>]*>([\\s\\S]*?)</c>`));
      if (!cellMatch) continue;

      const { label, url: formulaUrl } = readCellLabel(cellMatch[1], sharedStrings);
      const downloadUrl = toDriveDownloadUrl(formulaUrl || relationshipUrl) || formulaUrl || relationshipUrl;
      if (!label) continue;

      links[label.trim().toLowerCase()] = downloadUrl;
      links[normalizeGhostFileName(label)] = downloadUrl;
    }
  }

  return links;
}

async function fetchLiveSheetFileLinks() {
  const response = await fetch(xlsxExportUrl(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Ghost replay sheet export failed (${response.status}).`);
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  const sheetFile = zip.file('xl/worksheets/sheet1.xml');
  const relationshipsFile = zip.file('xl/worksheets/_rels/sheet1.xml.rels');

  if (!sharedStringsFile || !sheetFile || !relationshipsFile) {
    throw new Error('Ghost replay sheet export is missing expected worksheet data.');
  }

  const [sharedStringsXml, sheetXml, relationshipsXml] = await Promise.all([
    sharedStringsFile.async('text'),
    sheetFile.async('text'),
    relationshipsFile.async('text'),
  ]);

  return parseSheetFileLinks(
    sheetXml,
    parseHyperlinkRelationships(relationshipsXml),
    parseSharedStrings(sharedStringsXml),
  );
}

let cachedLinksPromise: Promise<Record<string, string>> | null = null;

export function fetchGhostSheetFileLinks() {
  if (!cachedLinksPromise) {
    cachedLinksPromise = (async () => {
      const manifest = await loadGhostDriveManifest();

      try {
        const liveLinks = await fetchLiveSheetFileLinks();
        return { ...manifest, ...liveLinks };
      } catch (error) {
        console.warn('Live ghost sheet link export unavailable, using manifest only:', error);
        return manifest;
      }
    })();
  }

  return cachedLinksPromise;
}

export function lookupSheetFileLink(links: Record<string, string>, fileName: string) {
  if (!fileName) return null;

  const candidates = [
    fileName.trim().toLowerCase(),
    normalizeGhostFileName(fileName),
    fileName.trim().toLowerCase().replace(/\s+/g, ' '),
  ];

  for (const key of candidates) {
    if (links[key]) return links[key];
  }

  return null;
}
