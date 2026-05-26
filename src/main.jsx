import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Configure cloud sync backend URL (set window.BACKEND_URL before calling upload)
// Example: window.BACKEND_URL = 'http://localhost:3001';
if (!window.BACKEND_URL) {
  const savedBackend = localStorage.getItem('backendUrl');
  if (savedBackend) window.BACKEND_URL = savedBackend;
}

const splashStart = Date.now();
const MIN_SPLASH = 1800;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const hideSplash = () => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.opacity = '0';
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
};

const elapsed = Date.now() - splashStart;
setTimeout(hideSplash, Math.max(MIN_SPLASH - elapsed, 0));
