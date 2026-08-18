import { BrowserRouter } from 'react-router-dom';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/hooks/useAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { convex } from '@/lib/convex';
import './index.css';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
}

const publicEmbed = /^\/(widget|help|ticket)(\/|$)/.test(window.location.pathname);

function AppProviders({ children }: { children: ReactNode }) {
  if (publicEmbed) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }
  return (
    <ConvexAuthProvider client={convex}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </ConvexAuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>
);
