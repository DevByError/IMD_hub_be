// Thin re-export so routes import middleware from `middlewares/`, matching
// the documented project structure — the actual scope+expiry resolution
// logic lives in services/permission.service.js since it's also needed
// outside of Express (e.g. when building UI-facing "what can I do" lists).
const { requirePermission, requireAnyPermission } = require('../services/permission.service');

module.exports = { requirePermission, requireAnyPermission };
