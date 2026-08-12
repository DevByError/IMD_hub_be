const roleService = require('../services/role.service');
const { asyncHandler } = require('../utils/asyncHandler');

const listRoles = asyncHandler(async (req, res) => {
  res.json({ roles: await roleService.listRoles() });
});

const listPermissions = asyncHandler(async (req, res) => {
  const delegableOnly = req.query.delegableOnly === 'true';
  res.json({ permissions: await roleService.listPermissions({ delegableOnly }) });
});

const listAssignableRoles = asyncHandler(async (req, res) => {
  res.json({ roles: await roleService.listAssignableRoles() });
});

const createRole = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body, req.user, req);
  res.status(201).json({ message: 'Role created.', role });
});

const updateRolePermissions = asyncHandler(async (req, res) => {
  const roles = await roleService.updateRolePermissions(req.params.id, req.body.permissionIds, req.user, req);
  res.json({ message: 'Role permissions updated.', roles });
});

const deleteRole = asyncHandler(async (req, res) => {
  await roleService.deleteRole(req.params.id, req.user, req);
  res.status(204).send();
});

const listAssignments = asyncHandler(async (req, res) => {
  res.json({ assignments: await roleService.listAssignments({ userId: req.query.userId }) });
});

const listAssignmentHistory = asyncHandler(async (req, res) => {
  res.json({ history: await roleService.listAssignmentHistory() });
});

const createAssignment = asyncHandler(async (req, res) => {
  const assignment = await roleService.createAssignment(req.body, req.user, req);
  res.status(201).json({ message: 'Role assigned.', assignment });
});

const revokeAssignment = asyncHandler(async (req, res) => {
  await roleService.revokeAssignment(req.params.id, req.user, req);
  res.status(204).send();
});

module.exports = {
  listRoles,
  listPermissions,
  listAssignableRoles,
  createRole,
  updateRolePermissions,
  deleteRole,
  listAssignments,
  listAssignmentHistory,
  createAssignment,
  revokeAssignment,
};
