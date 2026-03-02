import { initSentry } from '@/lib/sentry';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@/app.css';

initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
