module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('leave_types', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.ENUM('annual', 'medical', 'special', 'unpaid'), allowNull: false, unique: true },
      requires_document: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      auto_approve: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      submission_cutoff_rule: { type: Sequelize.JSON, allowNull: true },
      exclude_weekends: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      exclude_public_holidays: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      allow_carry_over: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('leave_types');
  },
};
