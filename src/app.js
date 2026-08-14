const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler.middleware');

// Factory rather than a plain built instance. The combined single-process
// deployment (server.combined.js — Express + the Next.js frontend sharing
// one Plesk Node.js app, one domain, no subdomain/proxy needed) passes in a
// `nextHandler` so any non-/api route falls through to Next instead of
// 404ing. The standalone entry point (server.js) calls this with no
// arguments and gets exactly the old behavior — fully backward compatible.
module.exports = function createApp({ nextHandler } = {}) {
  const app = express();

  // Trust exactly one hop of reverse proxy for req.ip / X-Forwarded-For —
  // this app sits behind Plesk's web server in production (see spec section
  // 10), so without this, every audit-log entry and rate-limit bucket would
  // key off the proxy's own IP instead of the real client's. `1` (not
  // `true`) deliberately trusts only the immediate proxy, not an arbitrary
  // forwarded chain, so a request that reaches this process directly can't
  // spoof its own IP via a forged X-Forwarded-For header. Harmless in local
  // dev — with no proxy in front, there's no X-Forwarded-For header to
  // trust, so req.ip still just reflects the real connection (e.g. ::1).
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Default script-src 'self' blocks Next.js's small inline hydration
      // bootstrap script, which only matters now that this same Express app
      // also serves the frontend pages (combined deployment) — the API-only
      // responses this used to exclusively guard don't execute scripts at
      // all, so this is strictly a frontend-serving concern. 'unsafe-inline'
      // is a deliberate, pragmatic relaxation here, not an oversight: it's
      // still strictly more restrictive than the standalone frontend
      // deployment had before (zero CSP header at all), and a proper
      // nonce-based CSP would need per-request wiring through Next's
      // middleware that isn't set up yet.
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
        },
      },
    })
  );
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true, // required so the refresh-token cookie is sent (harmless no-op once fe/be share an origin, kept for local dev where they don't)
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api', routes);

  // Combined-deployment only: anything that isn't an /api route falls
  // through to Next.js instead of hitting notFoundHandler below, so one
  // process can serve the whole site on a single domain.
  if (nextHandler) {
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      return nextHandler(req, res);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
