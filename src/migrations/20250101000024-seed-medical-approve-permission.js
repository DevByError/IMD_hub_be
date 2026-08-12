const { v4: uuidv4 } = require('uuid');

// Medical leave used to need no "approve" permission at all — it auto-
// approved on submission and was never handed to a decision-maker. Now that
// someone has to record the staff member's return date (and that action
// draws down the medical balance / computes unpaid overflow), it needs its
// own delegable permission, mirrored onto exactly the roles that already
// hold leave.view.medical (Department Manager, Department Admin, Team
// Admin) — see seed-permissions.js / seed-role-permissions.js for the
// original pattern this follows.
module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE `key` = 'leave.approve.medical'"
    );
    if (existing.length > 0) return; // already applied

    const permissionId = uuidv4();
    await queryInterface.bulkInsert('permissions', [
      {
        id: permissionId,
        key: 'leave.approve.medical',
        description: 'Record the return date for a Medical Leave request',
        category: 'leave',
        is_delegable: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    const [roleAssignments] = await queryInterface.sequelize.query(`
      SELECT DISTINCT rp.role_id AS roleId
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.key = 'leave.view.medical'
    `);

    if (roleAssignments.length > 0) {
      await queryInterface.bulkInsert(
        'role_permissions',
        roleAssignments.map((r) => ({
          id: uuidv4(),
          role_id: r.roleId,
          permission_id: permissionId,
          created_at: now,
          updated_at: now,
        }))
      );
    }
  },
  down: async (queryInterface) => {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE `key` = 'leave.approve.medical'"
    );
    if (rows.length === 0) return;
    const permissionId = rows[0].id;
    await queryInterface.bulkDelete('role_permissions', { permission_id: permissionId });
    await queryInterface.bulkDelete('permissions', { id: permissionId });
  },
};
