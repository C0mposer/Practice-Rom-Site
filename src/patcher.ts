export type SpyroPracticePatch = {
  file: string;
  name: string;
};

export const spyroPracticePatches: SpyroPracticePatch[] = [
  {
    file: 'patches/PS1_Practice_Rom.xdelta',
    name: 'Spyro 1 Practice Rom PS1/EMU',
  },
  {
    file: 'patches/DUCKSTATION_Practice_Rom.xdelta',
    name: 'Spyro 1 Practice Rom Duckstation',
  },
  {
    file: 'patches/PS2_DECKARD_Practice_Rom.xdelta',
    name: 'Spyro 1 Practice Rom PS2 (75k-90k)',
  },
  {
    file: 'patches/PS2_IOP_Practice_Rom.xdelta',
    name: 'Spyro 1 Practice Rom PS2 (30k-70k)',
  },
];

let patchSelectInitialized = false;
const patchBufferByFile = new Map<string, ArrayBuffer>();

function patchUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}

async function fetchPatch(path: string) {
  const cached = patchBufferByFile.get(path);
  if (cached) return cached;

  const response = await fetch(patchUrl(path), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load patch file (${response.status}): ${path}`);
  }

  const buffer = await response.arrayBuffer();
  patchBufferByFile.set(path, buffer);
  return buffer;
}

async function loadAvailablePatches() {
  const results = await Promise.allSettled(
    spyroPracticePatches.map(async (patch) => ({
      patch,
      buffer: await fetchPatch(patch.file),
    })),
  );

  return results.flatMap((result) => {
    if (result.status === 'fulfilled') {
      return [result.value];
    }

    console.warn('Practice ROM patch unavailable:', result.reason);
    return [];
  });
}

function createPatchBinFile(path: string, buffer: ArrayBuffer) {
  if (!window.BinFile) {
    throw new Error('Rom Patcher JS core is not ready yet.');
  }

  const binFile = new window.BinFile(buffer);
  binFile.fileName = path.split('/').pop() || path;
  return binFile;
}

function romPatcherHtml() {
  return window.RomPatcherWeb?.getHtmlElements?.();
}

export function getPrimaryEmbededPatch() {
  const primary = spyroPracticePatches[0];
  return { file: patchUrl(primary.file), name: primary.name };
}

function revealPatchSelect(select: HTMLSelectElement, enabledOptionCount: number) {
  const html = romPatcherHtml();
  select.classList.remove('single');
  select.classList.add(enabledOptionCount > 1 ? 'multiple' : 'single');
  select.disabled = enabledOptionCount === 0;
  html?.show('select-patch');
  html?.setEnabled('select-patch', enabledOptionCount > 0);
}

export async function setupSpyroPracticePatchSelect() {
  if (patchSelectInitialized) return;

  const select = document.getElementById('rom-patcher-select-patch') as HTMLSelectElement | null;
  if (!select) {
    throw new Error('Patch selector is missing from the patcher page.');
  }

  const available = await loadAvailablePatches();
  if (available.length === 0) {
    throw new Error(
      'No practice ROM patches are available. Add the .xdelta files under public/patches/ (see public/patches/README.md).',
    );
  }

  patchSelectInitialized = true;

  const loadingLabel = document.getElementById('rom-patcher-span-loading-embeded-patch');
  if (loadingLabel) {
    loadingLabel.style.display = 'none';
  }

  select.replaceWith(select.cloneNode(false) as HTMLSelectElement);
  const freshSelect = document.getElementById('rom-patcher-select-patch') as HTMLSelectElement;
  let enabledOptionCount = 0;
  let firstEnabledIndex = -1;

  spyroPracticePatches.forEach((patch, index) => {
    const isAvailable = patchBufferByFile.has(patch.file);
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = isAvailable ? patch.name : `${patch.name} (not on server)`;
    option.disabled = !isAvailable;
    if (isAvailable) {
      enabledOptionCount += 1;
      if (firstEnabledIndex < 0) firstEnabledIndex = index;
    }
    freshSelect.appendChild(option);
  });

  revealPatchSelect(freshSelect, enabledOptionCount);

  const applyPatchAtIndex = async (index: number) => {
    const patch = spyroPracticePatches[index];
    if (!patchBufferByFile.has(patch.file)) {
      throw new Error(`Patch is not available on the server: ${patch.file}`);
    }

    const buffer = patchBufferByFile.get(patch.file) ?? (await fetchPatch(patch.file));
    const binFile = createPatchBinFile(patch.file, buffer);
    window.RomPatcherWeb?.providePatchFile(binFile);
    revealPatchSelect(freshSelect, enabledOptionCount);
  };

  freshSelect.addEventListener('change', () => {
    void applyPatchAtIndex(Number(freshSelect.value)).catch((error) => {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Could not load the selected patch.';
      window.RomPatcherWeb?.getHtmlElements?.().setText('error-message', message);
      window.RomPatcherWeb?.getHtmlElements?.().addClass('row-error-message', 'show');
    });
  });

  if (firstEnabledIndex >= 0) {
    freshSelect.value = String(firstEnabledIndex);
  }
}

export function waitForEmbededPatchSelect() {
  return new Promise<void>((resolve, reject) => {
    let attempts = 0;

    const poll = () => {
      const select = document.getElementById('rom-patcher-select-patch') as HTMLSelectElement | null;

      if (patchSelectInitialized) {
        resolve();
        return;
      }

      if (select && select.options.length > 0) {
        resolve();
        return;
      }

      attempts += 1;
      if (attempts >= 200) {
        reject(new Error('Timed out waiting for practice ROM patches to load.'));
        return;
      }

      window.setTimeout(poll, 50);
    };

    poll();
  });
}
