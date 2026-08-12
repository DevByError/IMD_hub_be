const { encryptField, decryptField } = require('../utils/encryption');

module.exports = (sequelize, DataTypes) => {
  const RegistrationRequest = sequelize.define(
    'RegistrationRequest',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      fullName: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false },
      phoneNumber: { type: DataTypes.STRING, allowNull: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      requestedRoleId: { type: DataTypes.UUID, allowNull: true },
      requestedTeamId: { type: DataTypes.UUID, allowNull: true },
      status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
      reviewedBy: { type: DataTypes.UUID, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
      rejectionReason: { type: DataTypes.STRING, allowNull: true },

      // Applicant-provided personal/identity fields. Employment fields
      // (position, employmentType, dateJoined, staffId) are NOT collected
      // here — the Manager sets those at approval time, since they're
      // employment decisions, not applicant-reported facts (and dateJoined
      // specifically drives leave entitlement tiers).
      idDocumentType: { type: DataTypes.ENUM('passport', 'ic'), allowNull: true },
      // Same encrypt-at-rest getter/setter as User.idDocumentNumber (see
      // user.model.js for the full explanation) — this table holds the same
      // kind of PII before an applicant is even approved into a User row.
      idDocumentNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        get() {
          const raw = this.getDataValue('idDocumentNumber');
          return raw ? decryptField(raw) : raw;
        },
        set(value) {
          this.setDataValue('idDocumentNumber', value ? encryptField(value) : value);
        },
      },
      dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true },
      address: { type: DataTypes.TEXT, allowNull: true },
      gender: { type: DataTypes.ENUM('male', 'female', 'other'), allowNull: true },
      nationality: { type: DataTypes.STRING, allowNull: true },
      nextOfKinName: { type: DataTypes.STRING, allowNull: true },
      nextOfKinContact: { type: DataTypes.STRING, allowNull: true },

      cvOriginalName: { type: DataTypes.STRING, allowNull: true },
      cvStoredPath: { type: DataTypes.STRING, allowNull: true },
      cvMimeType: { type: DataTypes.STRING, allowNull: true },
      cvSizeBytes: { type: DataTypes.INTEGER, allowNull: true },

      profilePhotoOriginalName: { type: DataTypes.STRING, allowNull: true },
      profilePhotoStoredPath: { type: DataTypes.STRING, allowNull: true },
      profilePhotoMimeType: { type: DataTypes.STRING, allowNull: true },
      profilePhotoSizeBytes: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      tableName: 'registration_requests',
    }
  );

  RegistrationRequest.associate = (models) => {
    RegistrationRequest.belongsTo(models.Role, { foreignKey: 'requestedRoleId', as: 'requestedRole' });
    RegistrationRequest.belongsTo(models.Team, { foreignKey: 'requestedTeamId', as: 'requestedTeam' });
    RegistrationRequest.belongsTo(models.User, { foreignKey: 'reviewedBy', as: 'reviewer' });
  };

  return RegistrationRequest;
};
