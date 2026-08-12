module.exports = (sequelize, DataTypes) => {
  const Team = sequelize.define(
    'Team',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: 'teams',
      paranoid: true,
    }
  );

  Team.associate = (models) => {
    Team.hasMany(models.TeamMember, { foreignKey: 'teamId', as: 'members' });
    Team.belongsToMany(models.User, { through: models.TeamMember, foreignKey: 'teamId', as: 'staff' });
    Team.hasMany(models.UserRoleAssignment, { foreignKey: 'scopeId', as: 'scopedAssignments', constraints: false });
  };

  return Team;
};
