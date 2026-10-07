import { defineConfig, loadEnv } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  // Vite does not put .env files into process.env for the config, so read the Sentry build
  // settings (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT) from them here. The plugin also
  // reads a .env.sentry-build-plugin file by itself.
  const env = loadEnv(mode, process.cwd(), 'SENTRY_');
  return {
    // Relative asset paths, so the built site works from any folder of a static host.
    base: './',
    build: {
      // main.js awaits at the top level, which needs a modern target.
      target: 'es2022',
      chunkSizeWarningLimit: 1000, // three.js, Sentry and the app share one bundle on purpose
      // Source maps for Sentry, so production stack traces are readable. "hidden" leaves out the
      // comment pointing browsers at them, and the plugin deletes them once they are uploaded.
      sourcemap: 'hidden',
    },
    plugins: [
      // Keep the Sentry plugin last.
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      }),
    ],
  };
});
