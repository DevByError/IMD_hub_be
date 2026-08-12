// System Updates was redesigned: it's no longer a database-backed,
// role-managed feature (see migrations 025-028) — only the developer edits
// SYSTEM_UPDATE_CONFIG directly in the frontend codebase, and each user's
// acknowledgment is tracked client-side (localStorage), not server-side.
// This migration removes everything the old approach added: both tables
// and the system_update.manage permission (and its role grants).
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.dropTable('system_update_acks');
    await queryInterface.dropTable('system_updates');

    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE `key` = 'system_update.manage'"
    );
    if (rows.length > 0) {
      const permissionId = rows[0].id;
      await queryInterface.bulkDelete('role_permissions', { permission_id: permissionId });
      await queryInterface.bulkDelete('permissions', { id: permissionId });
    }
  },
  down: async (queryInterface, Sequelize) => {
    // Recreates empty tables matching migrations 025/026 — the permission
    // grant isn't restored since which roles held it isn't recoverable here.
    await queryInterface.createTable('system_updates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      version: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: false },
      created_by: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.createTable('system_update_acks', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      system_update_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'system_updates', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      acknowledged_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('system_update_acks', ['system_update_id', 'user_id'], { unique: true });
  },
};
