# Ghost replay files on Google Drive

The ghost replay page reads **metadata** live from the Google Sheet (gviz API) and reads **download hyperlinks** from the same sheet’s public XLSX export (column F links you set in Google Sheets).

You usually do **not** need extra setup if column F already contains Drive links.

Fallbacks if a download is missing:

1. **`public/ghost-drive-manifest.json`** — run `npm run sync:ghosts`  
2. **Apps Script** below — re-link column F from a Drive folder

## Option A — Link files from Drive inside the sheet (recommended)

1. Open the spreadsheet → **Extensions → Apps Script**
2. Paste the script from [`scripts/LinkGhostDriveFiles.gs`](../scripts/LinkGhostDriveFiles.gs)
3. Set `GHOST_FOLDER_ID` to your Drive folder ID (from the folder URL: `.../folders/FOLDER_ID`)
4. Run **`linkGhostFilesFromDrive`** once (or add a weekly trigger)
5. Column F will get `HYPERLINK(...)` download URLs. The website picks them up automatically on refresh.

The Drive folder must be shared so the script can read it (same Google account is fine).

## Option B — Manifest file (for deploy / CI)

1. Create a [Google Cloud API key](https://console.cloud.google.com/apis/credentials) with **Google Drive API** enabled
2. Share the ghost folder: **Anyone with the link → Viewer**
3. Add to `.env.local`:

```env
GHOST_DRIVE_FOLDER_ID=your_folder_id_here
GOOGLE_API_KEY=your_api_key_here
```

4. Run:

```bash
npm run sync:ghosts
```

5. Commit `public/ghost-drive-manifest.json` (or run this step in CI before `npm run build`)

Re-run `sync:ghosts` when you add or rename files in Drive.
