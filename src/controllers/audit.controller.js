const auditService = require('../services/audit.service');
const { asyncHandler } = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { action, actorUserId, targetType, from, to, limit } = req.query;
  res.json({ logs: await auditService.listAuditLogs({ action, actorUserId, targetType, from, to, limit }) });
});

module.exports = { list };
