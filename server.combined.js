// Single-process production entry: runs the backend API and the Next.js
// frontend together in one Plesk Node.js app, on one domain, with no
// subdomain or web-server proxy config required.
//
// Why this exists: the split deployment (backend on api.<domain>, frontend
// on <domain>, bridged by a reverse proxy) needed either a public DNS record
// for the api subdomain or an "Additional nginx/Apache directives" box —
// neither was available on this Plesk subscription. Running both in one
// process sidesteps that entirely: the browser only ever talks to one
// origin, and this file decides internally whether a request is `/api/*`
// (handled by Express) or anything else (handed to Next.js).
//
// Deployment layout this assumes — matches what's already on the server:
//   httpdocs/backend/   <- this file, package.json, src/ (Application Root)
//   httpdocs/div/       <- the Next.js frontend, already `next build`-ed,
//                          with its own node_modules (sibling folder, not
//                          moved or copied — Next is required directly out
//                          of its node_modules below)
//
// Plesk Node.js panel for the main domain should point at:
//   Application Root:    httpdocs/backend
//   Application Startup File: server.combined.js

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const { connectDB } = require('./src/config/db');
const { logger } = require('./src/utils/logger');
const createApp = require('./src/app');

// Frontend folder is a sibling of this one. Try a couple of likely names so
// this doesn't silently break if it's ever renamed.
const FRONTEND_CANDIDATES = ['div', 'fe'];
const frontendDir = FRONTEND_CANDIDATES
  .map((name) => path.join(__dirname, '..', name))
  .find((dir) => fs.existsSync(dir));

if (!frontendDir) {
  throw new Error(
    `Could not find the frontend folder next to ${__dirname} (looked for: ${FRONTEND_CANDIDATES.join(', ')}). ` +
      'Expected it as a sibling folder, e.g. httpdocs/backend and httpdocs/div side by side.'
  );
}

const nextModulePath = path.join(frontendDir, 'node_modules', 'next');
if (!fs.existsSync(nextModulePath)) {
  throw new Error(
    `Found frontend folder at ${frontendDir}, but it has no node_modules/next. Run "npm install" in that folder first.`
  );
}

// eslint-disable-next-line import/no-dynamic-require, global-require
const next = require(nextModulePath);
const nextApp = next({ dev: false, dir: frontendDir });
const nextHandler = nextApp.getRequestHandler();

const PORT = process.env.PORT || 4000;

let isShuttingDown = false;

async function start() {
  try {
    logger.info('======================================');
    logger.info('Starting IMD HUB (combined) server...');
    logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
    logger.info(`PORT: ${PORT}`);
    logger.info(`Frontend dir: ${frontendDir}`);
    logger.info('======================================');

    await connectDB();
    logger.info('Database connected successfully');

    await nextApp.prepare();
    logger.info('Next.js frontend prepared');

    const app = createApp({ nextHandler });
    const server = app.listen(PORT, () => {
      logger.info(`IMD HUB (combined) listening on port ${PORT}`);
    });

    const shutdown = (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info(`${signal} received. Closing server...`);
      server.close(() => {
        logger.info('Server closed.');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start combined server:', err);
    process.exit(1);
  }
}

start();
