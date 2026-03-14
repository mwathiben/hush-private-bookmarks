import { initSentry } from '@/lib/sentry';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@/app.css';

initSentry();

const mq = window.matchMedia('(prefers-color-scheme: dark)');
document.documentElement.classList.toggle('dark', mq.matches);
mq.addEventListener('change', (e) => {
  document.documentElement.classList.toggle('dark', e.matches);
});

function TestErrorTrigger() {
  if (new URLSearchParams(window.location.search).has('__test_throw')) {
    throw new Error('Test error trigger');
  }
  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TestErrorTrigger />
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
