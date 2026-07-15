import React from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.jsx';
import { removeLegacyPwaArtifacts } from './lib/legacyPwaCleanup.js';
import './index.css';

const isNativePlatform = Capacitor.isNativePlatform();
const isEmbedded = window.self !== window.top;

if (isNativePlatform) {
  document.documentElement.classList.add('native-platform');
} else {
  const scopeUrl = new URL(import.meta.env.BASE_URL, window.location.href).href;
  void removeLegacyPwaArtifacts({ scopeUrl });
}

const rootElement = document.getElementById('root');

if (isEmbedded) {
  const notice = document.createElement('p');
  notice.textContent = 'A játék biztonsági okból csak önálló ablakban nyitható meg.';
  rootElement.replaceChildren(notice);
} else {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
