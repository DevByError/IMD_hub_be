const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler.middleware');

const app = express();

// Trust exactly one hop of reverse proxy for req.ip / X-Forwarded-For — this
// app sits behind Plesk's Nginx in production (see spec section 10), so
// without this, every audit-log entry and rate-limit bucket would key off
// Nginx's own IP instead of the real client's. `1` (not `true`) deliberately
// trusts only the immediate proxy, not an arbitrary forwarded chain, so a
// request that reaches this process directly can't spoof its own IP via a
// forged X-Forwarded-For header. Harmless in local dev — with no proxy in
// front, there's no X-Forwarded-For header to trust, so req.ip still just
// reflects the real connection (e.g. ::1). If another proxy layer is ever
// added in front of Nginx (a CDN, etc.), bump this to 2.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, // required so the refresh-token cookie is sent cross-origin (fe/be on different subdomains in production)
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
