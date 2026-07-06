import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      const update = () => registration.update().catch(() => undefined);

      void update();
      window.setTimeout(update, 3000);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void update();
        }
      });
    } catch {
      // The app remains usable online if service worker registration is unavailable.
    }
  });
}
