module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('system_update_acks', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      system_update_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'system_updates', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      acknowledged_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('system_update_acks', ['system_update_id', 'user_id'], { unique: true });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('system_update_acks');
  },
};
