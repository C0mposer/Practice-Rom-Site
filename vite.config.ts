import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveGhostReplaySheetId } from './src/ghostSheetConfig';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Custom domain (spyropracticerom.com) serves from /. Subpath base is only for *.github.io/repo/ URLs.
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const configuredBase = process.env.VITE_BASE?.trim();
  const base = configuredBase || (repoName ? `/${repoName}/` : '/');
  const ghostSheetId = resolveGhostReplaySheetId(env.VITE_GHOST_REPLAY_SHEET_ID);

  return {
    base,
    plugins: [react()],
    server: {
      proxy: {
        '/api/ghost-sheet-export': {
          target: 'https://docs.google.com',
          changeOrigin: true,
          rewrite: () => `/spreadsheets/d/${ghostSheetId}/export?format=xlsx`,
        },
        '/api/ghost-sheet-gviz': {
          target: 'https://docs.google.com',
          changeOrigin: true,
          rewrite: (path) => {
            const gid = new URL(path, 'http://localhost').searchParams.get('gid') || '0';
            return `/spreadsheets/d/${ghostSheetId}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}`;
          },
        },
      },
    },
  };
});
