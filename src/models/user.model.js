const { encryptField, decryptField } = require('../utils/encryption');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      fullName: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
      phoneNumber: { type: DataTypes.STRING, allowNull: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      idDocumentType: { type: DataTypes.ENUM('passport', 'ic'), allowNull: true },
      // Encrypted at rest (AES-256-GCM, see utils/encryption.js). The
      // getter/setter make that transparent everywhere else in the app:
      // `user.idDocumentNumber = 'S1234567A'` stores an encrypted blob,
      // reading `user.idDocumentNumber` back (including via .toJSON(), which
      // res.json() calls implicitly) decrypts it. That means this getter
      // still returns the real plaintext — masking for ordinary API
      // responses happens one layer up, in user.service.js's sanitizeUser().
      // Never return a raw model instance straight to res.json(); go through
      // that helper (or revealIdDocumentNumber() for the one legitimate,
      // audited exception).
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
      // Either an "/api/files/:id" path (set at registration approval, via
      // the disk-based upload system) or a "data:image/...;base64,..." URI
      // (set later via the self-service avatar upload — see
      // user.service.js updateOwnPhoto). MEDIUMTEXT because a base64 data
      // URI is well beyond what a STRING(255) column can hold.
      profilePhotoUrl: { type: DataTypes.TEXT('medium'), allowNull: true },
      position: { type: DataTypes.STRING, allowNull: true },
      employmentType: { type: DataTypes.ENUM('full_time', 'part_time', 'contract'), allowNull: true },
      dateJoined: { type: DataTypes.DATEONLY, allowNull: true },
      cvUrl: { type: DataTypes.STRING, allowNull: true },
      nationality: { type: DataTypes.STRING, allowNull: true },
      staffId: { type: DataTypes.STRING, allowNull: true, unique: true }, // "TAC"
      status: {
        type: DataTypes.ENUM('pending', 'active', 'inactive', 'suspended'),
        allowNull: false,
        defaultValue: 'pending',
      }, // account/login status — governs whether this person can sign in at all
      staffStatus: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      }, // HR employment status (Active = currently employed, Inactive = resigned/terminated/long-term absence) — separate from login access, set by Manager/Department Admin
      nextOfKinName: { type: DataTypes.STRING, allowNull: true },
      nextOfKinContact: { type: DataTypes.STRING, allowNull: true },
      lastAppraisalDate: { type: DataTypes.DATEONLY, allowNull: true },
      tokenValidAfter: { type: DataTypes.DATE, allowNull: true }, // any JWT issued before this is rejected (session invalidation on reset)
    },
    {
      tableName: 'users',
      paranoid: true, // never hard-delete staff records
    }
  );

  User.associate = (models) => {
    User.hasMany(models.TeamMember, { foreignKey: 'userId', as: 'teamMemberships' });
    User.belongsToMany(models.Team, { through: models.TeamMember, foreignKey: 'userId', as: 'teams' });
    User.hasMany(models.UserRoleAssignment, { foreignKey: 'userId', as: 'roleAssignments' });
    User.hasMany(models.LeaveBalance, { foreignKey: 'userId', as: 'leaveBalances' });
    User.hasMany(models.LeaveRequest, { foreignKey: 'userId', as: 'leaveRequests' });
    User.hasMany(models.LeaveRequest, { foreignKey: 'reviewedBy', as: 'reviewedLeaveRequests' });
    User.hasMany(models.OtpVerification, { foreignKey: 'userId', as: 'otpVerifications' });
    User.hasMany(models.ResetToken, { foreignKey: 'userId', as: 'resetTokens' });
    User.hasMany(models.Notification, { foreignKey: 'userId', as: 'notifications' });
    User.hasMany(models.RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
    User.hasMany(models.AuditLog, { foreignKey: 'actorUserId', as: 'auditLogs' });
  };

  return User;
};
