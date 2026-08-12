const { v4: uuidv4 } = require('uuid');

// New permission for the System Updates feature — unlike leave.approve.medical
// (which mirrored an existing permission's role_permissions), there's no
// prior grant to copy here: this one is genuinely new, so it's assigned
// directly to the Department Manager role by name. Delegable, so the
// Manager can hand it to a Department Admin (or anyone) later via the
// Roles & Permissions page if they want someone else to publish updates too.
module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE `key` = 'system_update.manage'"
    );
    if (existing.length > 0) return; // already applied

    const permissionId = uuidv4();
    await queryInterface.bulkInsert('permissions', [
      {
        id: permissionId,
        key: 'system_update.manage',
        description: 'Publish system update notices (version + release notes) that every user must acknowledge',
        category: 'system',
        is_delegable: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    const [managerRoles] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'Department Manager'"
    );
    if (managerRoles.length > 0) {
      await queryInterface.bulkInsert('role_permissions', [
        {
          id: uuidv4(),
          role_id: managerRoles[0].id,
          permission_id: permissionId,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
  },
  down: async (queryInterface) => {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE `key` = 'system_update.manage'"
    );
    if (rows.length === 0) return;
    const permissionId = rows[0].id;
    await queryInterface.bulkDelete('role_permissions', { permission_id: permissionId });
    await queryInterface.bulkDelete('permissions', { id: permissionId });
  },
};
