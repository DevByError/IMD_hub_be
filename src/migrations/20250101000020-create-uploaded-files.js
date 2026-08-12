module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('uploaded_files', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      owner_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      uploaded_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      purpose: { type: Sequelize.ENUM('cv', 'profile_photo', 'mc_document', 'other'), allowNull: false },
      original_name: { type: Sequelize.STRING, allowNull: false },
      stored_path: { type: Sequelize.STRING, allowNull: false },
      mime_type: { type: Sequelize.STRING, allowNull: false },
      size_bytes: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('uploaded_files', ['owner_user_id', 'purpose']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('uploaded_files');
  },
};
