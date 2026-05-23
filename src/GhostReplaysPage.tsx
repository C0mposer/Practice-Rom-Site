import { useEffect, useState } from 'react';
import { Download, ExternalLink, Ghost, HardDriveDownload } from 'lucide-react';
import {
  getGhostToolDuckstationRelease,
  getGhostToolPs2Release,
  LINKS,
} from './github';
import {
  countAvailableGhosts,
  countDownloadableGhosts,
  fetchGhostReplayCategories,
  type GhostReplayCategory,
} from './ghostReplays';
import type { GitHubRelease } from './types';

const ghostSheetUrl =
  'https://docs.google.com/spreadsheets/d/1FRsIFruvudBQzKBPcCEm27SErnol9FkRNUDLPE_SKMI/edit';

type GhostTab = 'setup' | 'downloads';
const ghostDownloadCategoryTabs = ['Any%', '120%', 'Vortex', 'Flights'] as const;
type GhostDownloadCategoryTab = (typeof ghostDownloadCategoryTabs)[number];

function releaseAsset(release: GitHubRelease | null) {
  return release?.assets[0] ?? null;
}

function GhostReplayRow({
  entry,
}: {
  entry: GhostReplayCategory['entries'][number];
}) {
  if (!entry.hasFile) {
    return (
      <div className="ghost-row ghost-row-missing">
        <div className="ghost-cell ghost-level">{entry.level}</div>
        <div className="ghost-cell ghost-muted ghost-missing-note">No replay uploaded yet</div>
      </div>
    );
  }

  return (
    <div className="ghost-row">
      <div className="ghost-cell ghost-level">{entry.level}</div>
      <div className="ghost-cell">{entry.name || '—'}</div>
      <div className="ghost-cell ghost-time">{entry.time || '—'}</div>
      <div className="ghost-cell ghost-description">{entry.description || '—'}</div>
      <div className="ghost-cell ghost-action">
        {entry.downloadUrl ? (
          <a className="ghost-download" href={entry.downloadUrl} download rel="noreferrer">
            <Download size={16} />
            Download
          </a>
        ) : (
          <span className="ghost-download ghost-download-pending" title={entry.fileName}>
            Link pending
          </span>
        )}
      </div>
    </div>
  );
}

function GhostDownloadsPanel() {
  const [categories, setCategories] = useState<GhostReplayCategory[]>([]);
  const [activeCategoryName, setActiveCategoryName] = useState<GhostDownloadCategoryTab>('Any%');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchGhostReplayCategories()
      .then((data) => {
        if (!cancelled) {
          setCategories(data);
          setError('');
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tabCategories = ghostDownloadCategoryTabs
    .map((name) => categories.find((category) => category.name === name))
    .filter((category): category is GhostReplayCategory => Boolean(category));
  const activeCategory =
    categories.find((category) => category.name === activeCategoryName) ?? tabCategories[0] ?? null;
  const availableCount = countAvailableGhosts(tabCategories);
  const downloadableCount = countDownloadableGhosts(tabCategories);

  useEffect(() => {
    if (loading || categories.length === 0) return;
    if (categories.some((category) => category.name === activeCategoryName)) return;

    const firstAvailable = ghostDownloadCategoryTabs.find((name) =>
      categories.some((category) => category.name === name),
    );
    if (firstAvailable) setActiveCategoryName(firstAvailable);
  }, [activeCategoryName, categories, loading]);

  return (
    <section className="ghost-replays-panel">
      <div className="ghost-replays-toolbar">
        <p className="muted">
          {loading
            ? 'Loading ghosts from Google Sheets...'
            : ``}
            {/* : `${downloadableCount} of ${availableCount} replay${availableCount === 1 ? '' : 's'} ready to download across ${tabCategories.length} categories`} */}
        </p>
        <div className="ghost-replays-toolbar-links">
          <a className="ghost-sheet-link" href={ghostSheetUrl} target="_blank" rel="noreferrer">
            Submit a Ghost
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {error ? <div className="loading-card">{error}</div> : null}

      {!error && !loading ? (
        <>
          <div className="ghost-page-tabs ghost-category-tabs" role="tablist" aria-label="Ghost replay categories">
            {ghostDownloadCategoryTabs.map((categoryName) => {
              const category = categories.find((nextCategory) => nextCategory.name === categoryName);
              const isActive = activeCategory?.name === categoryName;

              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={isActive ? 'active' : ''}
                  disabled={!category}
                  onClick={() => setActiveCategoryName(categoryName)}
                  key={categoryName}
                >
                  {categoryName}
                </button>
              );
            })}
          </div>

          {activeCategory ? (
            <section className="ghost-category" key={activeCategory.name}>
              <header className="ghost-category-header">
                <h2>{activeCategory.name}</h2>
                {activeCategory.progress ? <span className="ghost-progress">{activeCategory.progress}</span> : null}
                <span className="ghost-category-count">
                  {activeCategory.entries.filter((entry) => entry.hasFile).length} replay
                  {activeCategory.entries.filter((entry) => entry.hasFile).length === 1 ? '' : 's'}
                </span>
              </header>

              <div className="ghost-table" role="table" aria-label={`${activeCategory.name} ghost replays`}>
                <div className="ghost-row ghost-row-head" role="row">
                  <div className="ghost-cell" role="columnheader">
                    Level
                  </div>
                  <div className="ghost-cell" role="columnheader">
                    Player
                  </div>
                  <div className="ghost-cell" role="columnheader">
                    Time
                  </div>
                  <div className="ghost-cell" role="columnheader">
                    Description
                  </div>
                  <div className="ghost-cell" role="columnheader">
                    File
                  </div>
                </div>

                {activeCategory.entries.map((entry) => (
                  <GhostReplayRow
                    entry={entry}
                    key={`${activeCategory.name}-${entry.level}-${entry.fileName}-${entry.time}`}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="loading-card">No replay categories are ready yet.</div>
          )}
        </>
      ) : null}

      {loading ? <div className="loading-card">Loading ghost replays...</div> : null}
    </section>
  );
}

function GhostSetupPanel() {
  const [duckstationRelease, setDuckstationRelease] = useState<GitHubRelease | null>(null);
  const [ps2Release, setPs2Release] = useState<GitHubRelease | null>(null);
  const [loadingTools, setLoadingTools] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getGhostToolDuckstationRelease(), getGhostToolPs2Release()])
      .then(([duckstation, ps2]) => {
        if (!cancelled) {
          setDuckstationRelease(duckstation);
          setPs2Release(ps2);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTools(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const duckstationAsset = releaseAsset(duckstationRelease);
  const ps2Asset = releaseAsset(ps2Release);

  return (
    <section className="ghost-setup-panel">
      <p className="ghost-setup-lead muted">
        Download the ghost tool for the platform you play on.
      </p>

      <div className="ghost-setup-grid">
        <article className="ghost-setup-card">
          <header className="ghost-setup-card-header">
            <h2>PS2 (75k–90k)</h2>
            <a className="ghost-sheet-link" href={LINKS.ghostToolPs2} target="_blank" rel="noreferrer">
              Source
              <ExternalLink size={14} />
            </a>
          </header>

          <ol className="ghost-setup-steps">
            <li>Copy <code>ghost_tool.elf</code> to the root of your USB drive</li>
            <li>
              <strong>Save:</strong> After you get a ghost you'd like to save in game, <strong>soft reset</strong> the console (tap power button). Launch ghost_tool.elf from uLaunchELF (mass:). Click <strong>SAVE GHOST</strong>, then confirm with X.
            </li>
            <li>
              <strong>Load:</strong> Before booting the practice rom, launch ghost_tool.elf from uLaunchELF (mass:). Click <strong>LOAD GHOST</strong>, then pick the
              ghost you'd like to load. Insert your Practice Rom disc when prompted, then boot the disc from the PS2 browser.
            </li>
          </ol>

          <div className="ghost-setup-actions">
            {ps2Asset ? (
              <a className="ghost-download" href={ps2Asset.browser_download_url} download rel="noreferrer">
                <HardDriveDownload size={16} />
                Download {ps2Asset.name}
                {ps2Release ? ` (${ps2Release.tag_name})` : ''}
              </a>
            ) : (
              <a className="ghost-download" href={LINKS.ghostToolPs2} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                View releases
              </a>
            )}
            <p className="ghost-setup-note muted">
              PS2 tool:{' '}
              <a href={LINKS.ghostToolPs2} target="_blank" rel="noreferrer">
                Ghost-Tool
              </a>
            </p>
          </div>
        </article>

        <article className="ghost-setup-card">
          <header className="ghost-setup-card-header">
            <h2>Duckstation (Emulator)</h2>
            <a className="ghost-sheet-link" href={LINKS.ghostToolDuckstation} target="_blank" rel="noreferrer">
              Source
              <ExternalLink size={14} />
            </a>
          </header>

          <ol className="ghost-setup-steps">
            <li>Launch the Spyro 1 Practice Rom in DuckStation, and turn on IL mode and Ghosts.</li>
            <li>
              <strong>Save:</strong> After you get a ghost you'd like to keep, open <code>ghost_tool.exe</code> and click{' '}
              <strong>Save Ghost File</strong>.
            </li>
            <li>
              <strong>Load:</strong> Open <code>ghost_tool.exe</code>, click <strong>Load Ghost File</strong>, pick a
              ghost file, then level-select into that level if you're not already there.
            </li>
          </ol>

          <div className="ghost-setup-actions">
            {duckstationAsset ? (
              <a className="ghost-download" href={duckstationAsset.browser_download_url} download rel="noreferrer">
                <HardDriveDownload size={16} />
                Download {duckstationAsset.name}
                {duckstationRelease ? ` (${duckstationRelease.tag_name})` : ''}
              </a>
            ) : (
              <a className="ghost-download" href={LINKS.ghostToolDuckstation} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                View releases
              </a>
            )}
            <p className="ghost-setup-note muted">
              Duckstation tool:{' '}
              <a href={LINKS.ghostToolDuckstation} target="_blank" rel="noreferrer">
                Emulator-Ghost-Tool
              </a>
            </p>
          </div>
        </article>
      </div>

      {loadingTools ? <div className="loading-card">Checking for latest tool releases...</div> : null}
    </section>
  );
}

export function GhostReplaysPage() {
  const [tab, setTab] = useState<GhostTab>('setup');

  return (
    <main className="page ghost-replays-page">
      <section className="page-intro">
        <div className="section-kicker">
          <Ghost size={16} />
          Ghost Replays
        </div>
        <div className="section-heading">
          <h1>Ghosts</h1>
          <p></p>
        </div>
      </section>

      <div className="ghost-page-tabs" role="tablist" aria-label="Ghosts sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'setup'}
          className={tab === 'setup' ? 'active' : ''}
          onClick={() => setTab('setup')}
        >
          Setup
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'downloads'}
          className={tab === 'downloads' ? 'active' : ''}
          onClick={() => setTab('downloads')}
        >
          Download Replays
        </button>
      </div>

      {tab === 'setup' ? <GhostSetupPanel /> : <GhostDownloadsPanel />}
    </main>
  );
}
