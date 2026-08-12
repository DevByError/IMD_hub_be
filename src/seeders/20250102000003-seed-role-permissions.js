const { v4: uuidv4 } = require('uuid');

// Default starting bundles. The Manager can adjust any of these later through
// the role/permission editor — this is just a sane out-of-the-box setup.
// Department Manager gets everything, including the three non-delegable
// system permissions (role.create / role.assign / permission_bundle.create) —
// those three are NEVER assigned to any other role, seeded or custom.
const DEPARTMENT_ADMIN_KEYS = [
  'team.create', 'team.manage', 'user.manage', 'registration.approve',
  'leave.view.annual', 'leave.approve.annual',
  'leave.view.medical', 'leave.approve.medical',
  'leave.view.special',
  'leave.view.unpaid', 'leave.approve.unpaid',
  'leave.override',
  'audit.view',
];

const TEAM_ADMIN_KEYS = [
  'team.manage',
  'leave.view.annual', 'leave.approve.annual',
  'leave.view.medical', 'leave.approve.medical',
  'leave.view.special',
  'leave.view.unpaid', 'leave.approve.unpaid',
];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    const [roles] = await queryInterface.sequelize.query('SELECT id, name FROM roles');
    const [permissions] = await queryInterface.sequelize.query('SELECT id, `key` FROM permissions');

    const roleIdByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));
    const permIdByKey = Object.fromEntries(permissions.map((p) => [p.key, p.id]));

    const rows = [];
    const addAll = (roleId, keys) => {
      keys.forEach((key) => {
        if (!permIdByKey[key]) return;
        rows.push({ id: uuidv4(), role_id: roleId, permission_id: permIdByKey[key], created_at: now, updated_at: now });
      });
    };

    // Manager: every permission that exists.
    addAll(roleIdByName['Department Manager'], Object.keys(permIdByKey));
    addAll(roleIdByName['Department Admin'], DEPARTMENT_ADMIN_KEYS);
    addAll(roleIdByName['Team Admin'], TEAM_ADMIN_KEYS);
    // Staff: intentionally no permission-bundle rows — self-service access
    // (own profile, own leave) is enforced by ownership checks, not RBAC.

    await queryInterface.bulkInsert('role_permissions', rows);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('role_permissions', null, {});
  },
};
