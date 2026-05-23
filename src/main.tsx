import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

function normalizeBrowserPath() {
  const { pathname, search, hash, origin } = window.location;
  let fixed = pathname.replace(/\/{2,}/g, '/');

  if (fixed.length > 1) {
    fixed = fixed.replace(/\/+$/, '');
  }

  if (!fixed) {
    fixed = '/';
  }

  if (fixed !== pathname) {
    window.history.replaceState(null, '', `${origin}${fixed}${search}${hash}`);
  }
}

normalizeBrowserPath();

createRoot(document.getElementById('root')!).render(<App />);
