module.exports = (sequelize, DataTypes) => {
  const ResetToken = sequelize.define(
    'ResetToken',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      consumedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'reset_tokens',
      updatedAt: false,
    }
  );

  ResetToken.associate = (models) => {
    ResetToken.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return ResetToken;
};
