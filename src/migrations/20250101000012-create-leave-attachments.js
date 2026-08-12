module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('leave_attachments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      leave_request_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'leave_requests', key: 'id' },
        onDelete: 'CASCADE',
      },
      file_url: { type: Sequelize.STRING, allowNull: false },
      uploaded_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('leave_attachments');
  },
};
