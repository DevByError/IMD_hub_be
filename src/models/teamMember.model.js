module.exports = (sequelize, DataTypes) => {
  const TeamMember = sequelize.define(
    'TeamMember',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      teamId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'team_members',
      indexes: [{ unique: true, fields: ['team_id', 'user_id'] }],
    }
  );

  TeamMember.associate = (models) => {
    TeamMember.belongsTo(models.Team, { foreignKey: 'teamId', as: 'team' });
    TeamMember.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return TeamMember;
};
