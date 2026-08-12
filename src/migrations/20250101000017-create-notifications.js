module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.STRING, allowNull: false },
      related_entity_type: { type: Sequelize.STRING, allowNull: true },
      related_entity_id: { type: Sequelize.UUID, allowNull: true },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('notifications', ['user_id', 'read_at']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('notifications');
  },
};
