import * as Sentry from '@sentry/browser';

/**
 * Error monitoring and tracing with Sentry, started before the rest of the
 * app is loaded so that errors while building the city are caught too.
 * The DSN comes from VITE_SENTRY_DSN (in .env.local, or the build
 * environment); without it the SDK stays off. Automated browsers (such as
 * the screenshot script) never report, so their runs do not flood the project.
 */
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: !navigator.webdriver,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  // Capture every transaction for tracing; lower this once the site has real traffic.
  tracesSampleRate: 1.0,
});

// The Sentry project is shared with other games, so mark everything with this repo:
// a tag for errors, and an attribute for spans, which do not carry tags.
Sentry.getGlobalScope().setTag('repo', 'constantinople').setAttribute('repo', 'constantinople');
