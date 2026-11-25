import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/anek-malayalam/400.css';
import '@fontsource/anek-malayalam/600.css';
import '@fontsource/anek-malayalam/700.css';
import './styles.css';
import './motion.css';
import App from './App';
import { AppProvider } from './lib/app';
import type { Api } from './data/api';
import { createDemoApi } from './data/demo';

// Firebase is used when its keys are in .env; otherwise the app runs in Demo mode.
const hasFirebase = !!import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_DEMO !== '1';

async function start() {
  const api: Api = hasFirebase ? (await import('./data/firebase')).createFirebaseApi() : createDemoApi();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProvider api={api}><App /></AppProvider>
    </StrictMode>,
  );
}
start();

// Offline support + "install app" on phones (only when served over https, not inside previews).
if ('serviceWorker' in navigator && hasFirebase && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
