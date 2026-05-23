import {
  BookOpen,
  Box,
  Clock3,
  Cpu,
  Download,
  ExternalLink,
  Gamepad2,
  Ghost,
  Github,
  HardDriveDownload,
  Home,
  Layers3,
  Route,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Wrench,
  X,
} from 'lucide-react';
import { marked } from 'marked';
import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { getLatestRelease, getWikiFiles, getWikiMarkdown, LINKS, resolveWikiAsset, titleFromFileName } from './github';
import { GhostReplaysPage } from './GhostReplaysPage';
import { getPrimaryEmbededPatch, setupSpyroPracticePatchSelect, waitForEmbededPatchSelect } from './patcher';
import type { GitHubRelease, WikiFile } from './types';

declare global {
  interface Window {
    RomPatcherWeb?: {
      initialize: (settings: Record<string, unknown>, embeddedPatchInfo?: unknown) => void;
      providePatchFile: (file: { fileName: string }) => void;
      getHtmlElements?: () => {
        show: (id: string) => void;
        setEnabled: (id: string, enabled: boolean) => void;
        setText: (id: string, text: string) => void;
        addClass: (id: string, className: string) => void;
      };
    };
    BinFile?: new (data: ArrayBuffer) => { fileName: string };
    __spyroPatcherInitialized?: boolean;
  }
}

const logoUrl = `${import.meta.env.BASE_URL}assets/comp-kara-logo.png`;
const duckstation8mbImageUrl = `${import.meta.env.BASE_URL}images/Duckstation%208MB.png`;
const heroArtworkUrl = `${import.meta.env.BASE_URL}assets/Composer_Kara.png`;

const navItems = [
  ['/', 'Home'],
  ['/downloads', 'Downloads'],
  ['/wiki', 'Wiki'],
  ['/patcher', 'Patcher'],
  ['/about', 'About'],
] as const;

const ghostNavPaths = new Set(['/ghosts', '/ghost-replays']);

const featureCards = [
  {
    title: 'Full Save States',
    body: 'Save and Load states to easily practice sections over and over.',
    icon: Gamepad2,
  },
  {
    title: 'Ghost Replays',
    body: 'Race against top-level movement like a racing game to refine your own movement.',
    icon: Ghost,
  },
  {
    title: 'Timing Tools',
    body: 'Built in timers to manually time tricks, movements, and routes.',
    icon: TimerReset,
  },
  {
    title: 'Much More',
    body: 'Level select, custom skins, collision visualizers, quality-of-life settings, and much more!',
    icon: Gem,
  },
];

const downloadBuilds = [
  {
    assetIncludes: 'PS2.Deckard',
    name: 'PS2 75k-90k',
    group: 'All Features',
    summary: 'Recommended console platform for the full feature set.',
    features: [
      ['Full Save States', true],
      ['Level Select', true],
      ['IL Mode', true],
      ['Timing Features', true],
      ['Nestor Skip Trainer', true],
      ['Custom Skins', true],
      ['Ghost Replays', true],
      ['Hitbox Viewer', true],
      ['Free Camera', true],
      ['Skin Editor', true],
    ],
  },
  {
    assetIncludes: 'Duckstation',
    name: 'Duckstation',
    group: 'All Features',
    summary: 'Recommended emulator platform for the full feature set.',
    features: [
      ['Full Save States', true],
      ['Level Select', true],
      ['IL Mode', true],
      ['Timing Features', true],
      ['Nestor Skip Trainer', true],
      ['Custom Skins', true],
      ['Ghost Replays', true],
      ['Hitbox Viewer', true],
      ['Free Camera', true],
      ['Skin Editor', true],
    ],
  },
  {
    assetIncludes: 'PS2.IOP',
    name: 'PS2 30k-70k',
    group: 'Partial Features',
    summary: 'Partial save states only: Spyro and camera position are saved.',
    features: [
      ['Partial Save States', true],
      ['Level Select', true],
      ['IL Mode', true],
      ['Timing Features', true],
      ['Nestor Skip Trainer', true],
      ['Custom Skins', true],
      ['Ghost Replays', false],
      ['Hitbox Viewer', false],
      ['Free Camera', false],
      ['Skin Editor', false],
    ],
  },
  {
    assetIncludes: 'PS1',
    name: 'PS1 & Other Emulators',
    group: 'Partial Features',
    summary: 'Partial save states only: Spyro and camera position are saved.',
    features: [
      ['Partial Save States', true],
      ['Level Select', true],
      ['IL Mode', true],
      ['Timing Features', true],
      ['Nestor Skip Trainer', true],
      ['Custom Skins', true],
      ['Ghost Replays', false],
      ['Hitbox Viewer', false],
      ['Free Camera', false],
      ['Skin Editor', false],
    ],
  },
] as const;

const downloadGroups = ['All Features', 'Partial Features'] as const;

function pagePath() {
  const basePath = new URL(import.meta.env.BASE_URL, window.location.origin).pathname.replace(/\/+$/, '');
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const withoutBase =
    basePath && basePath !== '/' && currentPath.startsWith(basePath)
      ? currentPath.slice(basePath.length).replace(/\/+$/, '') || '/'
      : currentPath;

  return withoutBase || '/';
}

function pageHref(path: string) {
  const target = new URL(path, new URL(import.meta.env.BASE_URL, window.location.origin));
  let pathname = target.pathname.replace(/\/{2,}/g, '/');

  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, '');
  }

  return `${pathname}${target.search}${target.hash}`;
}

function formatFileSize(size: number) {
  if (!size) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function getWikiFileNameFromHref(href: string) {
  if (!href.toLowerCase().endsWith('.md')) return '';
  return decodeURIComponent(href.split('/').pop() || '');
}

function getDownloadBuild(assetName: string) {
  return downloadBuilds.find((build) => assetName.includes(build.assetIncludes));
}

function getDownloadCards(assets: GitHubRelease['assets']) {
  const cards = downloadBuilds
    .map((build, index) => {
      const asset = assets.find((candidate) => candidate.name.includes(build.assetIncludes));
      return asset ? { asset, build, key: `${build.name}-${asset.id}`, index } : null;
    })
    .filter((card): card is { asset: GitHubRelease['assets'][number]; build: (typeof downloadBuilds)[number]; key: string; index: number } =>
      Boolean(card),
    );

  const matchedAssetIds = new Set(cards.map((card) => card.asset.id));
  const unmatchedCards = assets
    .filter((asset) => !matchedAssetIds.has(asset.id))
    .map((asset, offset) => ({ asset, build: undefined, key: `asset-${asset.id}`, index: downloadBuilds.length + offset }));

  return [...cards, ...unmatchedCards].sort((a, b) => a.index - b.index);
}

type DownloadCardModel = ReturnType<typeof getDownloadCards>[number];

function AppHeader() {
  const currentPath = pagePath();

  return (
    <header className="site-header">
      <a className="brand" href={pageHref('/')}>
        <img src={logoUrl} alt="Composer and OddKara logo" />
        <span>Spyro 1 Practice Rom</span>
      </a>
      <nav aria-label="Primary navigation">
        {navItems.map(([href, label]) => (
          <a className={currentPath === href ? 'active' : ''} href={pageHref(href)} key={href}>
            {label}
          </a>
        ))}
      </nav>
      <div className="header-actions">
        <a
          className={`ghosts-header-link${ghostNavPaths.has(currentPath) ? ' active' : ''}`}
          href={pageHref('/ghosts')}
          aria-label="Ghosts"
          aria-current={ghostNavPaths.has(currentPath) ? 'page' : undefined}
        >
          <Ghost size={18} strokeWidth={2.25} aria-hidden />
          <span>Ghosts</span>
        </a>
        <a className="github-button" href={LINKS.repo} target="_blank" rel="noreferrer">
          <Github size={18} />
          GitHub
        </a>
      </div>
    </header>
  );
}

function PageIntro({
  eyebrow,
  title,
  body,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof Sparkles;
}) {
  return (
    <section className="page-intro">
      <div className="section-kicker">
        <Icon size={16} />
        {eyebrow}
      </div>
      <div className="section-heading">
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </section>
  );
}

function LandingPage() {
  return (
    <main>
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <Gamepad2 size={18} />
            PS1 / PS2 / PS3 / Emulator
          </div>
          <h1>Spyro 1 Practice Rom</h1>
          <p>
            Built for speedrunners, <strong>by speedrunners</strong>. 
          </p>
          <div className="hero-actions">
            <a className="primary-action" href={pageHref('/downloads')}>
              <Download size={18} />
              Download Now
            </a>
            <a className="secondary-action" href={pageHref('/wiki')}>
              <BookOpen size={18} />
              Read Wiki
            </a>
          </div>
        </div>

        <div className="hero-art" aria-label="Composer and OddKara logo artwork">
          <div className="hero-art-frame">
            <img src={heroArtworkUrl} alt="Composer and OddKara artwork" />
          </div>
          <div className="hero-stat stat-a">
            <span>Made By</span>
            <strong>Composer & OddKara</strong>
          </div>
          {/* <div className="hero-stat stat-b">
            <span>Built For</span>
            <strong>Efficient practice</strong>
          </div> */}
        </div>
      </section>

      <section className="landing-features" aria-label="Practice Rom feature summary">
        <div className="feature-lead">
          <h2>
            Built for <strong>efficient</strong> practice
          </h2>
        </div>
        <div className="feature-grid">
          {featureCards.map(({ title, body, icon: Icon }) => (
            <article className="feature-card" key={title}>
              <Icon size={20} />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <span className="eyebrow">Download</span>
          <h2>Start Practicing</h2>
        </div>
        <div className="hero-actions">
          <a className="primary-action" href={pageHref('/downloads')}>
            <Download size={18} />
            Download Now
          </a>
          <a className="secondary-action" href={pageHref('/patcher')}>
            <Wrench size={18} />
            Patcher
          </a>
        </div>
      </section>
    </main>
  );
}

function PatcherPage() {
  const [status, setStatus] = useState('Loading patcher...');

  useEffect(() => {
    let attempts = 0;

    const initialize = () => {
      attempts += 1;

      if (window.__spyroPatcherInitialized) {
        setStatus('');
        return;
      }

      if (!window.RomPatcherWeb) {
        if (attempts < 80) {
          window.setTimeout(initialize, 50);
        } else {
          setStatus('The patcher could not load. Check your network and refresh the page.');
        }
        return;
      }

      try {
        window.RomPatcherWeb.initialize(
          {
            language: 'en',
            requireValidation: false,
            allowDropFiles: true,
            oninitialize: () => {
              waitForEmbededPatchSelect()
                .then(() => setupSpyroPracticePatchSelect())
                .then(() => setStatus(''))
                .catch((error) => {
                  setStatus(
                    error instanceof Error ? error.message : 'Practice ROM patches could not be loaded.',
                  );
                });
            },
          },
          getPrimaryEmbededPatch(),
        );
        window.__spyroPatcherInitialized = true;
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'The patcher could not initialize.');
      }
    };

    initialize();
  }, []);

  return (
    <main className="page">
      <PageIntro
        eyebrow="Patcher"
        title="Patch Your Own Rom"
        body="Patch your own Spyro 1 rom locally."
        icon={Wrench}
      />

      <section className="patcher-shell">
        <div className="patcher-topline">
          <div>
            <span className="eyebrow">ROM file</span>
            <strong>Spyro 1 .bin file</strong>
          </div>
          <div>
            <span className="eyebrow">Output</span>
            <strong>Patched practice ROM</strong>
          </div>
        </div>

        <div id="rom-patcher-container">
          <div className="rom-patcher-row margin-bottom" id="rom-patcher-row-file-rom">
            <div className="text-right">
              <label htmlFor="rom-patcher-input-file-rom" data-localize="yes">
                ROM file:
              </label>
            </div>
            <div className="rom-patcher-container-input">
              <input type="file" id="rom-patcher-input-file-rom" className="empty" disabled />
            </div>
          </div>

          <div className="margin-bottom text-selectable text-mono text-muted" id="rom-patcher-rom-info">
            <div className="rom-patcher-row">
              <div className="text-right">CRC32:</div>
              <div className="text-truncate">
                <span id="rom-patcher-span-crc32" />
              </div>
            </div>
            <div className="rom-patcher-row">
              <div className="text-right">MD5:</div>
              <div className="text-truncate">
                <span id="rom-patcher-span-md5" />
              </div>
            </div>
            <div className="rom-patcher-row">
              <div className="text-right">SHA-1:</div>
              <div className="text-truncate">
                <span id="rom-patcher-span-sha1" />
              </div>
            </div>
            <div className="rom-patcher-row" id="rom-patcher-row-info-rom">
              <div className="text-right">ROM:</div>
              <div className="text-truncate">
                <span id="rom-patcher-span-rom-info" />
              </div>
            </div>
          </div>

          <div className="rom-patcher-row margin-bottom" id="rom-patcher-row-file-patch">
            <div className="text-right">
              <label htmlFor="rom-patcher-select-patch" data-localize="yes">
                Patch file:
              </label>
            </div>
            <div className="rom-patcher-container-input">
              <select id="rom-patcher-select-patch" disabled />
              <span id="rom-patcher-span-loading-embeded-patch" style={{ display: 'none' }}>
                Downloading...
              </span>
            </div>
          </div>

          <div className="text-center" id="rom-patcher-row-apply">
            <div id="rom-patcher-row-error-message" className="margin-bottom">
              <span id="rom-patcher-error-message">{status}</span>
            </div>
            <button id="rom-patcher-button-apply" data-localize="yes" disabled>
              Apply patch
            </button>
          </div>
        </div>

        <a className="powered-link" href={LINKS.romPatcher} target="_blank" rel="noreferrer">
          Powered by Rom Patcher JS
          <ExternalLink size={14} />
        </a>
      </section>
    </main>
  );
}

function DownloadsPage() {
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getLatestRelease().then(setRelease).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="page">
      <PageIntro
        eyebrow="Downloads"
        title="Latest Downloads"
        body="Download the correct build for your platform"
        icon={HardDriveDownload}
      />

      <section className="release-panel">
        {release ? (
          <>
            <div className="release-title">
              <div>
                <span className="eyebrow">{release.tag_name}</span>
                <h2>{release.name}</h2>
              </div>
              <a className="icon-button" href={release.html_url} target="_blank" rel="noreferrer" aria-label="Open release">
                <ExternalLink size={18} />
              </a>
            </div>
            <p className="muted">Published {formatDate(release.published_at)}</p>
            <div className="download-groups">
              {downloadGroups.map((group) => {
                const cards = getDownloadCards(release.assets).filter((card) => card.build?.group === group);

                return (
                  <div className="download-group" key={group}>
                    <h3>{group}</h3>
                    <div className="download-grid">
                      {cards.map(({ asset, build, key }) => (
                        <DownloadCard asset={asset} build={build} key={key} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {getDownloadCards(release.assets)
                .filter((card) => !card.build)
                .map(({ asset, build, key }: DownloadCardModel) => (
                  <DownloadCard asset={asset} build={build} key={key} />
                ))}
            </div>
          </>
        ) : (
          <div className="loading-card">{error || 'Loading latest release...'}</div>
        )}
      </section>
    </main>
  );
}

function DuckstationDownloadModal({
  open,
  downloadUrl,
  onClose,
}: {
  open: boolean;
  downloadUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-dialog duckstation-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="duckstation-modal-title"
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2 id="duckstation-modal-title">Before you download</h2>
        <p className="modal-message">Make sure to enable 8MB RAM in Duckstation&apos;s Console settings!</p>
        <img
          className="duckstation-modal-image"
          src={duckstation8mbImageUrl}
          alt="DuckStation Console settings showing 8MB RAM enabled"
        />
        <div className="modal-actions">
          <a className="primary-action" href={downloadUrl} onClick={onClose}>
            <Download size={18} />
            Download
          </a>
          <button type="button" className="secondary-action" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DownloadCard({
  asset,
  build = getDownloadBuild(asset.name),
}: {
  asset: GitHubRelease['assets'][number];
  build?: (typeof downloadBuilds)[number];
}) {
  const [showDuckstationModal, setShowDuckstationModal] = useState(false);
  const isDuckstation = build?.name === 'Duckstation';

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isDuckstation) return;
    event.preventDefault();
    setShowDuckstationModal(true);
  };

  return (
    <>
      <a className="download-card" href={asset.browser_download_url} onClick={handleClick}>
        <div className="download-card-heading">
          <Download size={18} />
          <div>
            <span>{build?.name || asset.name}</span>
            <small>{asset.name}</small>
          </div>
        </div>
        {build && <p>{build.summary}</p>}
        {build && (
          <div className="feature-pills">
            {build.features.map(([feature, available]) => (
              <em className={available ? '' : 'unavailable'} key={feature}>
                {feature}
              </em>
            ))}
          </div>
        )}
        <small>
          {formatFileSize(asset.size)} / {asset.download_count.toLocaleString()} downloads
        </small>
      </a>

      {isDuckstation ? (
        <DuckstationDownloadModal
          open={showDuckstationModal}
          downloadUrl={asset.browser_download_url}
          onClose={() => setShowDuckstationModal(false)}
        />
      ) : null}
    </>
  );
}

function WikiPage() {
  const [files, setFiles] = useState<WikiFile[]>([]);
  const [selectedName, setSelectedName] = useState('README.md');
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getWikiFiles()
      .then((nextFiles) => {
        setFiles(nextFiles);
        if (!nextFiles.some((file) => file.name === selectedName) && nextFiles[0]) {
          setSelectedName(nextFiles[0].name);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [selectedName]);

  const selectedFile = files.find((file) => file.name === selectedName) || files[0];

  useEffect(() => {
    if (!selectedFile) return;

    setMarkdown('');
    getWikiMarkdown(selectedFile)
      .then(setMarkdown)
      .catch((err: Error) => setError(err.message));
  }, [selectedFile]);

  const wikiHtml = useMemo(() => {
    if (!markdown) return '';

    const renderer = new marked.Renderer();

    renderer.image = (token) => {
      const src = resolveWikiAsset(token.href);
      const title = token.title ? ` title="${token.title}"` : '';
      return `<img src="${src}" alt="${token.text}"${title}>`;
    };

    renderer.link = (token) => {
      const wikiFileName = getWikiFileNameFromHref(token.href);
      const href = wikiFileName ? pageHref('/wiki') : resolveWikiAsset(token.href);
      const title = token.title ? ` title="${token.title}"` : '';
      const wikiData = wikiFileName ? ` data-wiki-file="${wikiFileName}"` : '';
      return `<a href="${href}"${title}${wikiData} target="${href.startsWith('http') ? '_blank' : '_self'}" rel="noreferrer">${token.text}</a>`;
    };

    return marked.parse(markdown, { renderer, async: false });
  }, [markdown]);

  const openWikiLink = (event: MouseEvent<HTMLElement>) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-wiki-file]');
    const wikiFileName = link?.dataset.wikiFile;

    if (!wikiFileName || !files.some((file) => file.name === wikiFileName)) {
      return;
    }

    event.preventDefault();
    setSelectedName(wikiFileName);
  };

  return (
    <main className="page wiki-page">
      <PageIntro
        eyebrow="Wiki"
        title="Wiki Reader"
        body="A repository of all the information you need to use the practice rom."
        icon={BookOpen}
      />

      <section className="wiki-layout">
        <aside className="wiki-nav" aria-label="Wiki pages">
          {files.length ? (
            files.map((file) => (
              <button
                className={file.name === selectedFile?.name ? 'active' : ''}
                key={file.name}
                onClick={() => setSelectedName(file.name)}
              >
                {titleFromFileName(file.name)}
              </button>
            ))
          ) : (
            <span>{error || 'Loading wiki...'}</span>
          )}
        </aside>

        <article className="wiki-content">
          {selectedFile && (
            <div className="wiki-toolbar">
              <span>{selectedFile.name}</span>
              <a href={selectedFile.html_url} target="_blank" rel="noreferrer">
                Open source
                <ExternalLink size={14} />
              </a>
            </div>
          )}
          {wikiHtml ? (
            <div className="markdown-body" onClick={openWikiLink} dangerouslySetInnerHTML={{ __html: wikiHtml }} />
          ) : (
            <p className="loading-card">{error || 'Loading page...'}</p>
          )}
        </article>
      </section>
    </main>
  );
}

function AboutPage() {
  return (
    <main className="page">
      <PageIntro
        eyebrow="About"
        title=""
        body=""
        icon={ShieldCheck}
      />

      <section className="about-grid">
        <div className="about-card about-logo-card">
          <img src={logoUrl} alt="Composer and OddKara logo" />
          <h2>Made by: Composer & OddKara</h2>
          <p>Made with love by Composer & OddKara</p>
        </div>
        <div className="about-card">
          <Box size={20} />
          <h2>Source</h2>
          <p>View the source code on GitHub</p>
          <a href={LINKS.repo} target="_blank" rel="noreferrer">
            Source repository
            <ExternalLink size={14} />
          </a>
        </div>
        {/* <div className="about-card">
          <Clock3 size={20} />
          <h2>Docs</h2>
          <p>View the wiki source on GitHub</p>
          <a href={LINKS.sourceWiki} target="_blank" rel="noreferrer">
            Wiki source
            <ExternalLink size={14} />
          </a>
        </div> */}
      </section>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="page">
      <PageIntro
        eyebrow="Not found"
        title="That page is not here."
        body="Head back to the landing page or jump into the patcher."
        icon={Home}
      />
      <div className="hero-actions">
        <a className="primary-action" href={pageHref('/')}>
          <Home size={18} />
          Home
        </a>
        <a className="secondary-action" href={pageHref('/patcher')}>
          <Wrench size={18} />
          Patcher
        </a>
      </div>
    </main>
  );
}

function CurrentPage() {
  switch (pagePath()) {
    case '/':
      return <LandingPage />;
    case '/patcher':
      return <PatcherPage />;
    case '/downloads':
      return <DownloadsPage />;
    case '/ghosts':
    case '/ghost-replays':
      return <GhostReplaysPage />;
    case '/wiki':
      return <WikiPage />;
    case '/about':
      return <AboutPage />;
    default:
      return <NotFoundPage />;
  }
}

export function App() {
  return (
    <>
      <AppHeader />
      <CurrentPage />
    </>
  );
}
