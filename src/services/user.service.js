const { Op } = require('sequelize');
const { User, UserRoleAssignment, Role, Permission, Team, TeamMember } = require('../models');
const { AppError } = require('../middlewares/errorHandler.middleware');
const { hasPermission } = require('./permission.service');
const { recordAudit } = require('./audit.service');
const { maskIdNumber } = require('../utils/encryption');

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // matches the old multipart profile_photo limit
const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const DATA_URI_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

const SELF_EDITABLE_FIELDS = ['phoneNumber', 'address', 'gender', 'nextOfKinName', 'nextOfKinContact'];
const ADMIN_ONLY_FIELDS = [
  'fullName',
  'idDocumentType',
  'idDocumentNumber',
  'dateOfBirth',
  'position',
  'employmentType',
  'dateJoined',
  'nationality',
  'staffId',
  'status',
  'staffStatus',
  'lastAppraisalDate',
];

// The idDocumentNumber getter on the User model decrypts transparently
// (see user.model.js) — which means an unmodified Sequelize instance handed
// straight to res.json() would serialize the full plaintext value. This is
// the one place that gets stripped down before anything leaves this service:
// password hash dropped, ID number masked to its last 4 characters. The only
// deliberate way to get the real value back out is revealIdDocumentNumber()
// below, which is permission-checked the same way and audited every time.
const sanitizeUser = (userInstance) => {
  const raw = userInstance.toJSON ? userInstance.toJSON() : userInstance;
  const { passwordHash, ...safeUser } = raw;
  return { ...safeUser, idDocumentNumber: maskIdNumber(safeUser.idDocumentNumber) };
};

const getUserTeamId = async (userId) => {
  const membership = await TeamMember.findOne({ where: { userId } });
  return membership ? membership.teamId : null;
};

// user.manage is the broad "HR/admin" permission; a team.manage holder
// (scoped to this specific user's team) also counts as an admin for
// viewing/editing that one person's profile, since managing a team
// includes managing its staff's basic records.
const isAdminForTarget = async (requesterId, targetUserId) => {
  if (await hasPermission(requesterId, 'user.manage')) return true;
  const teamId = await getUserTeamId(targetUserId);
  return hasPermission(requesterId, 'team.manage', { scopeTeamId: teamId });
};

const getProfile = async (targetUserId, requester) => {
  const isSelf = requester.id === targetUserId;
  if (!isSelf && !(await isAdminForTarget(requester.id, targetUserId))) {
    throw new AppError(403, 'You do not have permission to view this profile.');
  }

  const user = await User.findByPk(targetUserId, { attributes: { exclude: ['passwordHash'] } });
  if (!user) throw new AppError(404, 'User not found.');
  return sanitizeUser(user);
};

// Full ID document number is deliberately never included in ordinary profile
// responses (see sanitizeUser above) — this is the one exception, gated by
// the exact same self-or-admin check as viewing the profile at all, and
// audited every single time someone actually looks at it in full.
const revealIdDocumentNumber = async (targetUserId, requester, req) => {
  const isSelf = requester.id === targetUserId;
  if (!isSelf && !(await isAdminForTarget(requester.id, targetUserId))) {
    throw new AppError(403, 'You do not have permission to view this profile.');
  }

  const user = await User.findByPk(targetUserId, { attributes: ['id', 'idDocumentNumber'] });
  if (!user) throw new AppError(404, 'User not found.');

  await recordAudit({
    actorUserId: requester.id,
    action: 'user.reveal_id_document',
    targetType: 'User',
    targetId: targetUserId,
    req,
  });

  return { idDocumentNumber: user.idDocumentNumber || null };
};

const updateProfile = async (targetUserId, body, requester, req) => {
  const user = await User.findByPk(targetUserId);
  if (!user) throw new AppError(404, 'User not found.');

  const isSelf = requester.id === targetUserId;
  const isAdmin = await isAdminForTarget(requester.id, targetUserId);
  if (!isSelf && !isAdmin) throw new AppError(403, 'You do not have permission to edit this profile.');

  const allowedFields = isAdmin ? [...SELF_EDITABLE_FIELDS, ...ADMIN_ONLY_FIELDS] : SELF_EDITABLE_FIELDS;
  const attemptedAdminFields = Object.keys(body).filter((k) => ADMIN_ONLY_FIELDS.includes(k));
  if (!isAdmin && attemptedAdminFields.length > 0) {
    throw new AppError(403, `You cannot edit: ${attemptedAdminFields.join(', ')}. Ask an administrator.`);
  }

  const updates = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) updates[field] = body[field];
  }

  Object.assign(user, updates);
  await user.save();

  await recordAudit({
    actorUserId: requester.id,
    action: 'user.update_profile',
    targetType: 'User',
    targetId: targetUserId,
    metadata: { fields: Object.keys(updates) },
    req,
  });

  return sanitizeUser(user);
};

// Highest-ranking role wins when a user holds more than one active
// assignment (e.g. a global grant plus a team-scoped one) — used to decide
// what a staff-list row's "role" badge should read on the frontend, and to
// flag the single Department Manager row (see isManager below).
const ROLE_PRIORITY = ['Department Manager', 'Department Admin', 'Team Admin', 'Staff'];

// Attaches `roleName` (the user's highest-priority active role, 'Staff' if
// none) and `isManager` to each row of a staff list — one batched query
// instead of N calls to isManagerAccount()/getMe() per row. Used by
// listStaff() so admin-facing pickers (add-to-team, ...) can exclude the
// Manager (never a team's "staff" — see team.service.js setStaffTeam), and
// so the frontend can show "Role: Active" for admin-role holders vs.
// "Staff: Active" for plain Staff without an extra permission-gated fetch.
const enrichStaffList = async (users) => {
  const userIds = users.map((u) => u.id);
  const assignments = await UserRoleAssignment.findAll({
    where: { userId: userIds, status: 'active' },
    include: [{ model: Role, as: 'role' }],
  });

  const roleNamesByUser = {};
  assignments.forEach((a) => {
    roleNamesByUser[a.userId] = roleNamesByUser[a.userId] || [];
    roleNamesByUser[a.userId].push(a.role.name);
  });

  return users.map((u) => {
    const plain = u.toJSON ? u.toJSON() : u;
    const names = roleNamesByUser[plain.id] || [];
    const roleName = ROLE_PRIORITY.find((r) => names.includes(r)) || names[0] || 'Staff';
    return { ...plain, idDocumentNumber: maskIdNumber(plain.idDocumentNumber), roleName, isManager: roleName === 'Department Manager' };
  });
};

// Self-service avatar upload — "press the profile circle" — saves the image
// inline as a base64 data URI rather than going through the disk-based
// upload system (see upload.service.js), so it's usable immediately with a
// plain <img src>. Self only: an admin changing someone else's photo isn't
// a use case that's been asked for, and this endpoint deliberately doesn't
// support it. The client is expected to have already downscaled/compressed
// the image before sending it (see fe/lib/imageUtils.js) — this is still
// re-validated server-side (never trust the client for size/type) as the
// only real defense against someone bypassing that and sending something huge.
const updateOwnPhoto = async (targetUserId, imageBase64, requester, req) => {
  if (requester.id !== targetUserId) {
    throw new AppError(403, 'You can only update your own profile photo.');
  }

  const match = DATA_URI_PATTERN.exec(imageBase64 || '');
  if (!match) throw new AppError(400, 'Invalid image data.');

  const [, mimeType, data] = match;
  if (!ALLOWED_PHOTO_MIME.includes(mimeType)) {
    throw new AppError(400, 'Only JPEG, PNG, or WebP images are allowed.');
  }

  const byteLength = Buffer.byteLength(data, 'base64');
  if (byteLength > MAX_PHOTO_BYTES) {
    throw new AppError(400, 'Image is too large (max 2MB after compression).');
  }

  const user = await User.findByPk(targetUserId);
  if (!user) throw new AppError(404, 'User not found.');

  user.profilePhotoUrl = imageBase64;
  await user.save();

  await recordAudit({
    actorUserId: requester.id,
    action: 'user.update_photo',
    targetType: 'User',
    targetId: targetUserId,
    req,
  });

  return sanitizeUser(user);
};

// Visible staff list, scoped to what the requester is allowed to manage:
// global admins (user.manage/role.assign) see everyone; a team-scoped
// team.manage holder sees only their team(s); anyone else gets nothing
// (this endpoint is for admin/picker UIs, not a general staff directory).
const listStaff = async (requester) => {
  const isGlobalAdmin =
    (await hasPermission(requester.id, 'user.manage')) || (await hasPermission(requester.id, 'role.assign'));

  if (isGlobalAdmin) {
    const users = await User.findAll({ attributes: { exclude: ['passwordHash'] }, order: [['fullName', 'ASC']] });
    return enrichStaffList(users);
  }

  const scopedAssignments = await UserRoleAssignment.findAll({
    where: { userId: requester.id, status: 'active', scopeType: 'team' },
  });
  const teamIds = [...new Set(scopedAssignments.map((a) => a.scopeId))];
  if (teamIds.length === 0) throw new AppError(403, 'You do not have permission to list staff.');

  const memberships = await TeamMember.findAll({ where: { teamId: teamIds } });
  const userIds = [...new Set(memberships.map((m) => m.userId))];

  const users = await User.findAll({ where: { id: userIds }, attributes: { exclude: ['passwordHash'] }, order: [['fullName', 'ASC']] });
  return enrichStaffList(users);
};

// Everything a logged-in client needs to render the right UI: profile,
// active role assignments (with their permissions and scope), and current
// team. This is a read model for the frontend — the actual authorization
// decision for any given action still goes through requirePermission()
// server-side on that action's route, never through what this returns.
const getMe = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['passwordHash'] },
  });

  const now = new Date();
  const assignments = await UserRoleAssignment.findAll({
    where: {
      userId,
      status: 'active',
      validFrom: { [Op.lte]: now },
      [Op.or]: [{ validUntil: null }, { validUntil: { [Op.gt]: now } }],
    },
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
  });

  const teamMemberships = await TeamMember.findAll({ where: { userId }, include: [{ model: Team, as: 'team' }] });

  const permissionKeys = [
    ...new Set(assignments.flatMap((a) => a.role.permissions.map((p) => p.key))),
  ];

  // The flat `permissions` list above answers "does this user hold
  // team.manage at all?" but throws away *which team* — a Team Admin
  // scoped to one team and a Department Admin with a global grant both just
  // show up as "has team.manage". The Teams page needs the scope back to
  // correctly hide the Manage button for teams a scoped Team Admin can't
  // actually act on (the backend already rejects those calls via
  // requirePermission('team.manage', { scopeParam: 'teamId' }) — this is
  // purely so the UI doesn't dangle a button that will just 403).
  // null = can manage every team (some assignment grants it globally);
  // an array = can only manage those specific team IDs.
  const scopedManageableTeamIds = new Set();
  let hasGlobalTeamManageGrant = false;
  for (const a of assignments) {
    const grantsTeamManagement = a.role.permissions.some((p) => p.key === 'team.manage' || p.key === 'team.create');
    if (!grantsTeamManagement) continue;
    if (a.scopeType === 'global') hasGlobalTeamManageGrant = true;
    else if (a.scopeType === 'team' && a.scopeId) scopedManageableTeamIds.add(a.scopeId);
  }
  const manageableTeamIds = hasGlobalTeamManageGrant ? null : [...scopedManageableTeamIds];

  return {
    user: sanitizeUser(user),
    roles: assignments.map((a) => ({
      roleId: a.roleId,
      roleName: a.role.name,
      scopeType: a.scopeType,
      scopeId: a.scopeId,
      validUntil: a.validUntil,
    })),
    permissions: permissionKeys,
    teams: teamMemberships.map((m) => ({ id: m.team.id, name: m.team.name })),
    manageableTeamIds,
  };
};

module.exports = { getMe, getProfile, updateProfile, updateOwnPhoto, listStaff, revealIdDocumentNumber };
