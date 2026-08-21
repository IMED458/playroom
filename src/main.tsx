import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ensureReady } from './core/app';
import { saveDbNow } from './core/db';

// ბაზა (sql.js + IndexedDB) მზადდება აპლიკაციის ჩატვირთვამდე
ensureReady().catch(err => {
  console.error('ბაზის ინიციალიზაცია ვერ მოხერხდა:', err);
});

// გვერდის დახურვამდე ცვლილებები ინახება დაუყოვნებლივ
const flush = () => { void saveDbNow(); };
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
