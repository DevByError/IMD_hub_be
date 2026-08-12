module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('otp_verifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      otp_hash: { type: Sequelize.STRING, allowNull: false },
      purpose: { type: Sequelize.ENUM('password_reset', 'registration_verify'), allowNull: false },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      consumed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('otp_verifications', ['user_id', 'purpose']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('otp_verifications');
  },
};
