export const DEFAULT_GHOST_REPLAY_SHEET_ID = '1FRsIFruvudBQzKBPcCEm27SErnol9FkRNUDLPE_SKMI';

export function resolveGhostReplaySheetId(raw?: string) {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_GHOST_REPLAY_SHEET_ID;

  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i);
  if (fromUrl?.[1]) return fromUrl[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return DEFAULT_GHOST_REPLAY_SHEET_ID;
}
