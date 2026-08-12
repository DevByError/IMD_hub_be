// Config file consumed by sequelize-cli for migrations/seeders.
// Kept separate from db.js (the runtime connection) because sequelize-cli
// requires this exact plain-object-per-environment shape.
require('dotenv').config();

const env = process.env;

const base = {
  username: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME || 'imd_hub',
  host: env.DB_HOST || 'localhost',
  port: Number(env.DB_PORT || 3306),
  dialect: 'mysql',
  define: {
    timestamps: true,
    underscored: true,
  },
};

module.exports = {
  development: base,
  test: { ...base, database: `${base.database}_test` },
  production: base,
};
