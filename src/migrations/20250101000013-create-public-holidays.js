module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('public_holidays', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      date: { type: Sequelize.DATEONLY, allowNull: false, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('public_holidays');
  },
};
