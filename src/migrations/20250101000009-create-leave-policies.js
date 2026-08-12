module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('leave_policies', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      leave_type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'leave_types', key: 'id' },
        onDelete: 'CASCADE',
      },
      min_years_service: { type: Sequelize.DECIMAL(4, 1), allowNull: false, defaultValue: 0 },
      max_years_service: { type: Sequelize.DECIMAL(4, 1), allowNull: true },
      days_entitled_per_year: { type: Sequelize.DECIMAL(4, 1), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('leave_policies');
  },
};
