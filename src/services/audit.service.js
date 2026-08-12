const { Op } = require('sequelize');
const {
  AuditLog,
  User,
  Role,
  Team,
  LeaveRequest,
  LeaveType,
  RegistrationRequest,
  UploadedFile,
  UserRoleAssignment,
  PublicHoliday,
} = require('../models');
const { logger } = require('../utils/logger');

// Fire-and-forget-safe audit write: callers await it (so ordering with the
// triggering transaction is predictable in tests), but a logging failure
// should never take down the actual business operation it's recording.
const recordAudit = async ({ actorUserId, action, targetType, targetId, metadata, req }) => {
  try {
    await AuditLog.create({
      actorUserId: actorUserId || null,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      metadata: metadata || null,
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    logger.error(`Failed to write audit log for action "${action}": ${err.message}`);
  }
};

// Every role.assign / role.revoke ever recorded, newest first — the full
// trace of "who held what role when" that the live UserRoleAssignment table
// alone can't answer once an assignment is revoked (or a role is swapped for
// another one). Feeds the Role Assignment History table on the Roles page.
const listRoleAssignmentHistory = () =>
  AuditLog.findAll({
    where: { action: { [Op.in]: ['role.assign', 'role.revoke'] } },
    include: [{ model: User, as: 'actor', attributes: ['id', 'fullName', 'email'] }],
    order: [['createdAt', 'DESC']],
  });

// Turns each log's raw targetType/targetId into a human-readable
// `targetName` (e.g. "Sarah Tan" instead of a UUID) — the Audit Log page is
// meant for the Manager/Department Admin reading it, not a developer with
// direct DB access, so a bare UUID isn't useful to them. Batches one lookup
// query per target type across the whole page of logs (never one query per
// row), then maps results back onto each entry. Rows whose target has since
// been hard-deleted, or whose targetType isn't one of the types below,
// simply get a null targetName — the frontend falls back to the type label.
const resolveTargetNames = async (logs) => {
  const idsByType = {};
  logs.forEach((l) => {
    if (!l.targetType || !l.targetId) return;
    (idsByType[l.targetType] = idsByType[l.targetType] || new Set()).add(l.targetId);
  });

  const nameByKey = {};
  const setName = (type, id, name) => {
    if (name) nameByKey[`${type}:${id}`] = name;
  };

  await Promise.all(
    Object.entries(idsByType).map(async ([type, idSet]) => {
      const ids = [...idSet];
      switch (type) {
        case 'User':
        case 'RegistrationRequest': {
          const Model = type === 'User' ? User : RegistrationRequest;
          const rows = await Model.findAll({ where: { id: ids }, attributes: ['id', 'fullName'], paranoid: false });
          rows.forEach((r) => setName(type, r.id, r.fullName));
          break;
        }
        case 'Role': {
          const rows = await Role.findAll({ where: { id: ids }, attributes: ['id', 'name'] });
          rows.forEach((r) => setName(type, r.id, r.name));
          break;
        }
        case 'Team': {
          const rows = await Team.findAll({ where: { id: ids }, attributes: ['id', 'name'], paranoid: false });
          rows.forEach((r) => setName(type, r.id, r.name));
          break;
        }
        case 'LeaveRequest': {
          const rows = await LeaveRequest.findAll({
            where: { id: ids },
            attributes: ['id'],
            include: [
              { model: User, as: 'applicant', attributes: ['fullName'], paranoid: false },
              { model: LeaveType, as: 'leaveType', attributes: ['name'] },
            ],
          });
          rows.forEach((r) =>
            setName(type, r.id, `${r.applicant?.fullName || 'Unknown staff'} — ${r.leaveType?.name || ''} leave`.trim())
          );
          break;
        }
        case 'UploadedFile': {
          const rows = await UploadedFile.findAll({ where: { id: ids }, attributes: ['id', 'originalName'] });
          rows.forEach((r) => setName(type, r.id, r.originalName));
          break;
        }
        case 'UserRoleAssignment': {
          const rows = await UserRoleAssignment.findAll({
            where: { id: ids },
            attributes: ['id'],
            include: [
              { model: User, as: 'user', attributes: ['fullName'], paranoid: false },
              { model: Role, as: 'role', attributes: ['name'] },
            ],
          });
          rows.forEach((r) => setName(type, r.id, `${r.user?.fullName || 'Unknown staff'} — ${r.role?.name || ''}`.trim()));
          break;
        }
        case 'PublicHoliday': {
          const rows = await PublicHoliday.findAll({ where: { id: ids }, attributes: ['id', 'name'] });
          rows.forEach((r) => setName(type, r.id, r.name));
          break;
        }
        default:
          break;
      }
    })
  );

  return logs.map((l) => {
    const plain = l.toJSON ? l.toJSON() : l;
    const key = plain.targetType && plain.targetId ? `${plain.targetType}:${plain.targetId}` : null;
    return { ...plain, targetName: key ? nameByKey[key] || null : null };
  });
};

// General-purpose audit log browser, feeding the Audit Log page (gated by
// the audit.view permission — see audit.routes.js). `action` is matched as a
// prefix (e.g. "leave." catches leave.submit/approve/reject/cancel/...) so
// the frontend can offer coarse category filters without having to know
// every exact action string. `limit` is capped at 1000 — this table only
// grows, and nothing here is paginated server-side yet; if this becomes the
// bottleneck the spec anticipated for other list endpoints, push the
// filtering into the WHERE clause with real pagination then.
const listAuditLogs = async ({ action, actorUserId, targetType, from, to, limit = 200 } = {}) => {
  const where = {};
  if (action) where.action = { [Op.like]: `${action}%` };
  if (actorUserId) where.actorUserId = actorUserId;
  if (targetType) where.targetType = targetType;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) where.createdAt[Op.lte] = new Date(to);
  }

  const logs = await AuditLog.findAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'fullName', 'email'] }],
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 200, 1000),
  });

  return resolveTargetNames(logs);
};

module.exports = { recordAudit, listRoleAssignmentHistory, listAuditLogs };
