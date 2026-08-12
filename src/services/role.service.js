const { Role, Permission, RolePermission, UserRoleAssignment, Team, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler.middleware');
const { assertPermissionsAreDelegable } = require('./permission.service');
const { recordAudit, listRoleAssignmentHistory } = require('./audit.service');

const MANAGER_ROLE_NAME = 'Department Manager';

const listRoles = () =>
  Role.findAll({ include: [{ model: Permission, as: 'permissions' }], order: [['createdAt', 'ASC']] });

const listPermissions = ({ delegableOnly } = {}) =>
  Permission.findAll({ where: delegableOnly ? { isDelegable: true } : {}, order: [['category', 'ASC'], ['key', 'ASC']] });

// Narrow, read-only id/name list of roles that can actually be handed to
// someone through createAssignment/registration approval (i.e. everything
// except the non-delegable Manager role) — needed by whoever picks a role
// on the registration-approval screen or the assignment form, which isn't
// only the Manager (a Department Admin approves registrations too, but
// doesn't hold role.create, so the full listRoles()/listPermissions()
// endpoints below are the wrong fit for them).
const listAssignableRoles = async () => {
  const roles = await listRoles();
  return roles
    .filter((role) => role.permissions.every((p) => p.isDelegable))
    .map((role) => ({ id: role.id, name: role.name }));
};

// Shared by role-assignment creation AND registration approval: a role that
// carries any non-delegable permission (role.create / role.assign /
// permission_bundle.create) can never be handed to a second person through
// an assignment action — that would silently create a second Manager.
// The Department Manager account is bootstrapped once, directly in the
// database (see seeders), and never again through the API.
const assertRoleIsAssignable = async (roleId) => {
  const role = await Role.findByPk(roleId, { include: [{ model: Permission, as: 'permissions' }] });
  if (!role) throw new AppError(400, 'Selected role does not exist.');
  const hasNonDelegable = role.permissions.some((p) => !p.isDelegable);
  if (hasNonDelegable) {
    throw new AppError(403, `The "${role.name}" role cannot be assigned through this action.`);
  }
  return role;
};

const createRole = async ({ name, permissionIds = [] }, creator, req) => {
  await assertPermissionsAreDelegable(permissionIds);

  const role = await sequelize.transaction(async (t) => {
    const newRole = await Role.create({ name, isSystemRole: false, createdBy: creator.id }, { transaction: t });
    if (permissionIds.length > 0) {
      await RolePermission.bulkCreate(
        permissionIds.map((permissionId) => ({ roleId: newRole.id, permissionId })),
        { transaction: t }
      );
    }
    return newRole;
  });

  await recordAudit({ actorUserId: creator.id, action: 'role.create', targetType: 'Role', targetId: role.id, metadata: { name, permissionIds }, req });
  return role;
};

const updateRolePermissions = async (roleId, permissionIds, actor, req) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new AppError(404, 'Role not found.');
  if (role.isSystemRole && role.name === MANAGER_ROLE_NAME) {
    throw new AppError(400, 'The Department Manager role cannot be modified.');
  }

  await assertPermissionsAreDelegable(permissionIds);

  await sequelize.transaction(async (t) => {
    await RolePermission.destroy({ where: { roleId }, transaction: t });
    if (permissionIds.length > 0) {
      await RolePermission.bulkCreate(
        permissionIds.map((permissionId) => ({ roleId, permissionId })),
        { transaction: t }
      );
    }
  });

  await recordAudit({ actorUserId: actor.id, action: 'role.update_permissions', targetType: 'Role', targetId: roleId, metadata: { permissionIds }, req });
  return listRoles();
};

const deleteRole = async (roleId, actor, req) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new AppError(404, 'Role not found.');
  if (role.isSystemRole) throw new AppError(400, 'System roles cannot be deleted.');

  const activeAssignments = await UserRoleAssignment.count({ where: { roleId, status: 'active' } });
  if (activeAssignments > 0) {
    throw new AppError(409, 'This role is still assigned to one or more users. Revoke those assignments first.');
  }

  await role.destroy();
  await recordAudit({ actorUserId: actor.id, action: 'role.delete', targetType: 'Role', targetId: roleId, req });
};

// --- Assignments (the actual "give access" delegation mechanism) ---------

const createAssignment = async ({ userId, roleId, scopeType, scopeId, validUntil }, grantor, req) => {
  await assertRoleIsAssignable(roleId);

  const resolvedScopeType = scopeType || 'global';
  if (resolvedScopeType === 'team') {
    if (!scopeId) throw new AppError(400, 'scopeId (team) is required for a team-scoped assignment.');
    const team = await Team.findByPk(scopeId);
    if (!team) throw new AppError(400, 'Team not found.');
  }

  if (validUntil && new Date(validUntil) <= new Date()) {
    throw new AppError(400, 'validUntil must be in the future.');
  }

  const assignment = await UserRoleAssignment.create({
    userId,
    roleId,
    scopeType: resolvedScopeType,
    scopeId: resolvedScopeType === 'team' ? scopeId : null,
    grantedBy: grantor.id,
    validUntil: validUntil || null,
    status: 'active',
  });

  await recordAudit({
    actorUserId: grantor.id,
    action: 'role.assign',
    targetType: 'User',
    targetId: userId,
    metadata: { roleId, scopeType: resolvedScopeType, scopeId, validUntil },
    req,
  });

  return assignment;
};

const revokeAssignment = async (assignmentId, actor, req) => {
  const assignment = await UserRoleAssignment.findByPk(assignmentId);
  if (!assignment) throw new AppError(404, 'Assignment not found.');
  if (assignment.status !== 'active') throw new AppError(409, 'This assignment is not active.');

  // Capture scope/duration before the status flip so the history record has
  // the same shape as the role.assign entry that created this assignment —
  // otherwise the History table can't say what scope/duration was just lost.
  const { userId, roleId, scopeType, scopeId, validUntil } = assignment;

  assignment.status = 'revoked';
  await assignment.save();

  await recordAudit({
    actorUserId: actor.id,
    action: 'role.revoke',
    targetType: 'UserRoleAssignment',
    targetId: assignment.id,
    metadata: { userId, roleId, scopeType, scopeId, validUntil },
    req,
  });

  return assignment;
};

const listAssignments = ({ userId } = {}) =>
  UserRoleAssignment.findAll({
    where: userId ? { userId } : {},
    include: [{ model: Role, as: 'role' }],
    order: [['createdAt', 'DESC']],
  });

module.exports = {
  listRoles,
  listPermissions,
  listAssignableRoles,
  createRole,
  updateRolePermissions,
  deleteRole,
  assertRoleIsAssignable,
  createAssignment,
  revokeAssignment,
  listAssignments,
  listAssignmentHistory: listRoleAssignmentHistory,
};
