/**
 * Spyro Practice Rom — link ghost .bin files from a Google Drive folder into column F.
 *
 * Setup:
 * 1. Extensions → Apps Script in the ghost spreadsheet
 * 2. Paste this file, set GHOST_FOLDER_ID below
 * 3. Run linkGhostFilesFromDrive (authorize Drive + Sheets when prompted)
 */

const GHOST_FOLDER_ID = 'PASTE_YOUR_DRIVE_FOLDER_ID_HERE';

function looksLikeGhostFile_(name) {
  return /\.bin$/i.test(name) || /^ghost_/i.test(name);
}

function normalizeFileName_(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function buildGhostFileMap_() {
  const map = {};
  const folder = DriveApp.getFolderById(GHOST_FOLDER_ID);
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const downloadUrl =
      'https://drive.google.com/uc?export=download&id=' + file.getId();
    map[normalizeFileName_(file.getName())] = downloadUrl;
  }

  return map;
}

function linkGhostFilesFromDrive() {
  const fileMap = buildGhostFileMap_();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();

  for (let row = 1; row <= lastRow; row++) {
    const fileName = String(sheet.getRange(row, 6).getValue() || '').trim();
    if (!looksLikeGhostFile_(fileName)) continue;

    const downloadUrl = fileMap[normalizeFileName_(fileName)];
    if (!downloadUrl) continue;

    sheet
      .getRange(row, 6)
      .setFormula('=HYPERLINK("' + downloadUrl + '","' + fileName.replace(/"/g, '""') + '")');
  }
}
