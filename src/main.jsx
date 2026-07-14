import React from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.jsx';
import { removeLegacyPwaArtifacts } from './lib/legacyPwaCleanup.js';
import './index.css';

const isNativePlatform = Capacitor.isNativePlatform();

if (isNativePlatform) {
  document.documentElement.classList.add('native-platform');
} else {
  const scopeUrl = new URL(import.meta.env.BASE_URL, window.location.href).href;
  void removeLegacyPwaArtifacts({ scopeUrl });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
