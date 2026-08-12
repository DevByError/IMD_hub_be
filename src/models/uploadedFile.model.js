module.exports = (sequelize, DataTypes) => {
  const UploadedFile = sequelize.define(
    'UploadedFile',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      ownerUserId: { type: DataTypes.UUID, allowNull: false }, // whose file this is (the staff member)
      uploadedBy: { type: DataTypes.UUID, allowNull: false }, // who actually performed the upload (self or an admin)
      purpose: { type: DataTypes.ENUM('cv', 'profile_photo', 'mc_document', 'other'), allowNull: false },
      originalName: { type: DataTypes.STRING, allowNull: false },
      storedPath: { type: DataTypes.STRING, allowNull: false }, // absolute path on disk, outside any public/static route
      mimeType: { type: DataTypes.STRING, allowNull: false },
      sizeBytes: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      tableName: 'uploaded_files',
      updatedAt: false,
    }
  );

  UploadedFile.associate = (models) => {
    UploadedFile.belongsTo(models.User, { foreignKey: 'ownerUserId', as: 'owner' });
    UploadedFile.belongsTo(models.User, { foreignKey: 'uploadedBy', as: 'uploader' });
  };

  return UploadedFile;
};
