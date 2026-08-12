module.exports = (sequelize, DataTypes) => {
  const OtpVerification = sequelize.define(
    'OtpVerification',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      otpHash: { type: DataTypes.STRING, allowNull: false },
      purpose: { type: DataTypes.ENUM('password_reset', 'registration_verify'), allowNull: false },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      consumedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'otp_verifications',
      updatedAt: false,
    }
  );

  OtpVerification.associate = (models) => {
    OtpVerification.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return OtpVerification;
};
