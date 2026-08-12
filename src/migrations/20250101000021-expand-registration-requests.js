module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Applicant-provided fields only — employment fields (position,
    // employment type, date joined, staff ID) are set by the Manager at
    // approval time, not self-reported, since Date Joined in particular
    // drives leave entitlement tiers. See spec discussion.
    await queryInterface.addColumn('registration_requests', 'id_document_type', {
      type: Sequelize.ENUM('passport', 'ic'),
      allowNull: true,
    });
    await queryInterface.addColumn('registration_requests', 'id_document_number', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'date_of_birth', { type: Sequelize.DATEONLY, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'address', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'gender', {
      type: Sequelize.ENUM('male', 'female', 'other'),
      allowNull: true,
    });
    await queryInterface.addColumn('registration_requests', 'nationality', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'next_of_kin_name', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'next_of_kin_contact', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.addColumn('registration_requests', 'cv_original_name', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'cv_stored_path', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'cv_mime_type', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'cv_size_bytes', { type: Sequelize.INTEGER, allowNull: true });

    await queryInterface.addColumn('registration_requests', 'profile_photo_original_name', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'profile_photo_stored_path', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'profile_photo_mime_type', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('registration_requests', 'profile_photo_size_bytes', { type: Sequelize.INTEGER, allowNull: true });
  },
  down: async (queryInterface) => {
    const columns = [
      'id_document_type', 'id_document_number', 'date_of_birth', 'address', 'gender', 'nationality',
      'next_of_kin_name', 'next_of_kin_contact',
      'cv_original_name', 'cv_stored_path', 'cv_mime_type', 'cv_size_bytes',
      'profile_photo_original_name', 'profile_photo_stored_path', 'profile_photo_mime_type', 'profile_photo_size_bytes',
    ];
    for (const col of columns) {
      await queryInterface.removeColumn('registration_requests', col);
    }
  },
};
