module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      full_name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      phone_number: { type: Sequelize.STRING, allowNull: true },
      password_hash: { type: Sequelize.STRING, allowNull: false },
      id_document_type: { type: Sequelize.ENUM('passport', 'ic'), allowNull: true },
      id_document_number: { type: Sequelize.STRING, allowNull: true },
      date_of_birth: { type: Sequelize.DATEONLY, allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      gender: { type: Sequelize.ENUM('male', 'female', 'other'), allowNull: true },
      profile_photo_url: { type: Sequelize.STRING, allowNull: true },
      position: { type: Sequelize.STRING, allowNull: true },
      employment_type: { type: Sequelize.ENUM('full_time', 'part_time', 'contract'), allowNull: true },
      date_joined: { type: Sequelize.DATEONLY, allowNull: true },
      cv_url: { type: Sequelize.STRING, allowNull: true },
      nationality: { type: Sequelize.STRING, allowNull: true },
      staff_id: { type: Sequelize.STRING, allowNull: true, unique: true },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'inactive', 'suspended'),
        allowNull: false,
        defaultValue: 'pending',
      },
      staff_status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      next_of_kin_name: { type: Sequelize.STRING, allowNull: true },
      next_of_kin_contact: { type: Sequelize.STRING, allowNull: true },
      last_appraisal_date: { type: Sequelize.DATEONLY, allowNull: true },
      token_valid_after: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  },
};
