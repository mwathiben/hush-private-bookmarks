import { initSentry } from '@/lib/sentry';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import React from 'react';
import ReactDOM from 'react-dom/client';
import ManagerApp from './ManagerApp.tsx';
import '@/app.css';

initSentry();

const saved = localStorage.getItem('hush-theme');
const mq = window.matchMedia('(prefers-color-scheme: dark)');
if (saved === 'dark') {
  document.documentElement.classList.add('dark');
} else if (saved === 'light') {
  document.documentElement.classList.remove('dark');
} else {
  document.documentElement.classList.toggle('dark', mq.matches);
}
mq.addEventListener('change', (e) => {
  const current = localStorage.getItem('hush-theme');
  if (!current || current === 'system') {
    document.documentElement.classList.toggle('dark', e.matches);
  }
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
      <ManagerApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
