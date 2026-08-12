const { Op } = require('sequelize');
const { UserRoleAssignment, Role, Permission, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler.middleware');

const MANAGER_ROLE_NAME = 'Department Manager';

// The bootstrapped Department Manager account sits outside the normal staff
// org structure entirely — no leave applications, no team membership (see
// spec). Single source of truth for "is this user that account", reused
// anywhere that rule needs enforcing (leave submission, team assignment,
// staff pickers, ...) instead of each call site re-deriving it.
const isManagerAccount = async (userId) => {
  const assignment = await UserRoleAssignment.findOne({
    where: { userId, status: 'active' },
    include: [{ model: Role, as: 'role', where: { name: MANAGER_ROLE_NAME } }],
  });
  return Boolean(assignment);
};

// Core of the permission engine: does this user currently hold this
// permission, in this scope, right now? Expiry is checked live in the query
// (validUntil IS NULL OR validUntil > NOW()) rather than via a cron job that
// flips a status flag — there's no window where an expired grant still
// works because a background job hasn't run yet.
//
// scopeTeamId: pass the team being acted on, if the action is team-scoped.
// A 'global' assignment always matches, regardless of scopeTeamId.
const hasPermission = async (userId, permissionKey, { scopeTeamId = null } = {}) => {
  const now = new Date();

  const scopeClause = scopeTeamId
    ? { [Op.or]: [{ scopeType: 'global' }, { scopeType: 'team', scopeId: scopeTeamId }] }
    : { scopeType: 'global' };

  const match = await UserRoleAssignment.findOne({
    where: {
      userId,
      status: 'active',
      validFrom: { [Op.lte]: now },
      [Op.and]: [scopeClause, { [Op.or]: [{ validUntil: null }, { validUntil: { [Op.gt]: now } }] }],
    },
    include: [
      {
        model: Role,
        as: 'role',
        required: true,
        include: [{ model: Permission, as: 'permissions', required: true, where: { key: permissionKey } }],
      },
    ],
  });

  return Boolean(match);
};

// Express middleware never gets to render this decision by hiding a button —
// every route that changes or exposes protected data must call this.
const requirePermission = (permissionKey, { scopeParam = null } = {}) => async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Not authenticated.');

    const scopeTeamId = scopeParam ? req.params[scopeParam] || req.body[scopeParam] : null;
    const allowed = await hasPermission(req.user.id, permissionKey, { scopeTeamId });

    if (!allowed) throw new AppError(403, 'You do not have permission to perform this action.');
    next();
  } catch (err) {
    next(err);
  }
};

// Passes if the requester holds ANY of the listed permissions (global scope
// only — this is for endpoints like the assignable-roles dropdown that
// several different roles legitimately need read access to, not for
// scope-sensitive actions). requirePermission stays the one used for actual
// authorization decisions on a single permission.
const requireAnyPermission = (permissionKeys) => async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Not authenticated.');

    for (const key of permissionKeys) {
      if (await hasPermission(req.user.id, key)) return next();
    }
    throw new AppError(403, 'You do not have permission to perform this action.');
  } catch (err) {
    next(err);
  }
};

// Used wherever the Manager (or anyone) attempts to attach permissions to a
// role/bundle for someone other than the Manager themself. Never trust the
// client to have already filtered these out.
const assertPermissionsAreDelegable = async (permissionIds) => {
  if (!permissionIds || permissionIds.length === 0) return;
  const nonDelegable = await Permission.findAll({
    where: { id: permissionIds, isDelegable: false },
  });
  if (nonDelegable.length > 0) {
    throw new AppError(
      403,
      `These permissions cannot be delegated: ${nonDelegable.map((p) => p.key).join(', ')}`
    );
  }
};

module.exports = {
  hasPermission,
  requirePermission,
  requireAnyPermission,
  assertPermissionsAreDelegable,
  isManagerAccount,
  MANAGER_ROLE_NAME,
};
