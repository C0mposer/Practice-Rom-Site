import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveGhostReplaySheetId } from '../src/ghostSheetConfig.ts';
import { parseGhostReplayTable, parseGvizPayload } from '../src/ghostReplays.ts';

const sheetId = resolveGhostReplaySheetId(process.env.VITE_GHOST_REPLAY_SHEET_ID);
const sheetGid = process.env.VITE_GHOST_REPLAY_SHEET_GID?.trim() || '0';
const manifestPath = resolve('public/ghost-drive-manifest.json');
const outputPath = resolve('public/ghost-replay-data.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, string>;
const response = await fetch(
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(sheetGid)}`,
);

if (!response.ok) {
  throw new Error(`Ghost replay sheet request failed (${response.status}).`);
}

const rows = parseGvizPayload(await response.text());
const categories = parseGhostReplayTable(rows, manifest).filter((category) => category.entries.length > 0);

writeFileSync(outputPath, `${JSON.stringify(categories, null, 2)}\n`, 'utf8');
console.log(`Wrote ${categories.length} ghost replay categories to ${outputPath}`);
