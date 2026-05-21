/** Public files in /public — always from site root, not the current route. */
export function publicAssetUrl(path: string) {
  const normalized = path.replace(/^\//, '');
  const base = import.meta.env.BASE_URL;

  if (base === './') {
    return `/${normalized}`;
  }

  return `${base}${normalized}`;
}
