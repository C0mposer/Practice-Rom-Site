import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';

const DEFAULT_SHEET_ID = '1FRsIFruvudBQzKBPcCEm27SErnol9FkRNUDLPE_SKMI';

function resolveSheetId(raw) {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_SHEET_ID;
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return DEFAULT_SHEET_ID;
}

const SHEET_ID = resolveSheetId(process.env.VITE_GHOST_REPLAY_SHEET_ID);

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function toDriveDownloadUrl(value) {
  const trimmed = value.trim();
  const fileIdMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
    trimmed.match(/\/open\?id=([a-zA-Z0-9_-]+)/i) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  const fileId = fileIdMatch?.[1];
  return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : trimmed;
}

function normalizeGhostFileName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseSharedStrings(xml) {
  const strings = [];
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const text = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((part) => decodeXml(part[1]))
      .join('');
    strings.push(text);
  }
  return strings;
}

function parseHyperlinkRelationships(xml) {
  const relationships = {};
  for (const match of xml.matchAll(
    /<Relationship Id="([^"]+)"[^>]*Type="[^"]*hyperlink"[^>]*Target="([^"]+)"/g,
  )) {
    relationships[match[1]] = decodeXml(match[2]);
  }
  return relationships;
}

function readCellLabel(cellXml, sharedStrings) {
  const valueMatch = cellXml.match(/<v>([^<]*)<\/v>/);
  if (!valueMatch) return '';
  const rawValue = decodeXml(valueMatch[1]);
  if (cellXml.includes('t="s"') || /^\d+$/.test(rawValue)) {
    return sharedStrings[Number(rawValue)] || rawValue;
  }
  return rawValue;
}

function parseSheetFileLinks(sheetXml, relationships, sharedStrings) {
  const links = {};

  const hyperlinkPatterns = [
    /<hyperlink[^>]*r:id="([^"]+)"[^>]*ref="([^"]+)"/g,
    /<hyperlink[^>]*ref="([^"]+)"[^>]*r:id="([^"]+)"/g,
  ];

  for (const pattern of hyperlinkPatterns) {
    for (const match of sheetXml.matchAll(pattern)) {
      const relationshipId = pattern === hyperlinkPatterns[0] ? match[1] : match[2];
      const cellRef = pattern === hyperlinkPatterns[0] ? match[2] : match[1];
      if (!cellRef.startsWith('F')) continue;

      const relationshipUrl = relationships[relationshipId];
      if (!relationshipUrl) continue;

      const cellMatch = sheetXml.match(new RegExp(`<c r="${cellRef}"[^>]*>([\\s\\S]*?)</c>`));
      if (!cellMatch) continue;

      const label = readCellLabel(cellMatch[1], sharedStrings);
      if (!label) continue;

      const downloadUrl = toDriveDownloadUrl(relationshipUrl);
      links[label.trim().toLowerCase()] = downloadUrl;
      links[normalizeGhostFileName(label)] = downloadUrl;
    }
  }

  return links;
}

const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`);
if (!response.ok) {
  throw new Error(`Sheet export failed (${response.status})`);
}

const zip = await JSZip.loadAsync(await response.arrayBuffer());
const sharedStringsXml = await zip.file('xl/sharedStrings.xml').async('text');
const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('text');
const relationshipsXml = await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('text');

const manifest = parseSheetFileLinks(
  sheetXml,
  parseHyperlinkRelationships(relationshipsXml),
  parseSharedStrings(sharedStringsXml),
);

const outputPath = resolve('public/ghost-drive-manifest.json');
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${Object.keys(manifest).length} download links to ${outputPath}`);
