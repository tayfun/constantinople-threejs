import * as Sentry from '@sentry/browser';

/**
 * Error monitoring and tracing with Sentry, started before the rest of the
 * app is loaded so that errors while building the city are caught too.
 * The DSN comes from VITE_SENTRY_DSN (in .env.local, or the build
 * environment); without it the SDK stays off.
 */
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  // Capture every transaction for tracing; lower this once the site has real traffic.
  tracesSampleRate: 1.0,
});
