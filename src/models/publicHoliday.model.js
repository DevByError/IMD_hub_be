module.exports = (sequelize, DataTypes) => {
  const PublicHoliday = sequelize.define(
    'PublicHoliday',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
    },
    {
      tableName: 'public_holidays',
      updatedAt: false,
    }
  );

  return PublicHoliday;
};
