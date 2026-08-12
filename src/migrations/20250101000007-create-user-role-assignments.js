module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_role_assignments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onDelete: 'CASCADE',
      },
      scope_type: { type: Sequelize.ENUM('global', 'team'), allowNull: false, defaultValue: 'global' },
      scope_id: { type: Sequelize.UUID, allowNull: true },
      granted_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      valid_from: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      valid_until: { type: Sequelize.DATE, allowNull: true },
      status: { type: Sequelize.ENUM('active', 'expired', 'revoked'), allowNull: false, defaultValue: 'active' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('user_role_assignments', ['user_id', 'status']);
    await queryInterface.addIndex('user_role_assignments', ['scope_id']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('user_role_assignments');
  },
};
