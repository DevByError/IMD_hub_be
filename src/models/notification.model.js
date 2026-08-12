module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    'Notification',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      message: { type: DataTypes.STRING, allowNull: false },
      relatedEntityType: { type: DataTypes.STRING, allowNull: true },
      relatedEntityId: { type: DataTypes.UUID, allowNull: true },
      readAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: 'notifications',
      updatedAt: false,
    }
  );

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Notification;
};
