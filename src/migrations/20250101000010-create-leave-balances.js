module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('leave_balances', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      leave_type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'leave_types', key: 'id' },
        onDelete: 'CASCADE',
      },
      year: { type: Sequelize.INTEGER, allowNull: false },
      entitled_days: { type: Sequelize.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      used_days: { type: Sequelize.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      carried_over_days: { type: Sequelize.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('leave_balances', ['user_id', 'leave_type_id', 'year'], { unique: true });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('leave_balances');
  },
};
