const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const { logger } = require('../utils/logger');

dotenv.config();

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

// Flexible env-var detection so the same code works across hosting providers
// that name MySQL vars differently (Railway-style MYSQLHOST, Plesk/plain DB_HOST, etc).
const readVar = (...keys) => keys.map((k) => env[k]).find((v) => v !== undefined && v !== '');

const dbName = readVar('DB_NAME', 'MYSQLDATABASE', 'MYSQL_DATABASE');
const dbUser = readVar('DB_USER', 'MYSQLUSER', 'MYSQL_USER');
const dbPassword = readVar('DB_PASSWORD', 'MYSQLPASSWORD', 'MYSQL_PASSWORD');
const dbHost = readVar('DB_HOST', 'MYSQLHOST', 'MYSQL_HOST') || 'localhost';
const dbPort = Number(readVar('DB_PORT', 'MYSQLPORT', 'MYSQL_PORT') || 3306);

// Validate BEFORE applying any dev-only fallback, so a missing var in
// production actually fails loudly instead of silently connecting as root.
if (!dbName || !dbUser || (isProduction && !dbPassword)) {
  const presentDbVars = Object.keys(env)
    .filter((key) => key.includes('MYSQL') || key.includes('DATABASE') || key.startsWith('DB_'))
    .sort()
    .join(', ');
  throw new Error(
    `Database config missing. Set DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT. Present keys: ${presentDbVars || 'none'}`
  );
}

logger.info(`Database config: host=${dbHost} port=${dbPort} db=${dbName} user=${dbUser}`);

const sequelize = new Sequelize(dbName, dbUser, dbPassword || '', {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: isProduction ? false : (msg) => logger.debug(msg),
  pool: {
    max: Number(env.DB_POOL_MAX || 10),
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  retry: { max: 3 },
  define: {
    timestamps: true,
    underscored: true,
    // NOTE: paranoid (soft delete) is intentionally NOT set globally here.
    // Set it per-model only where it makes sense (users, teams, leave_requests) —
    // tables like otp_verifications/reset_tokens/audit_logs should hard-delete.
  },
  timezone: '+00:00',
  dialectOptions: {
    connectTimeout: 60000,
  },
});

// Single connection check, called once by the app entrypoint (server.js).
// No duplicate fire-and-forget authenticate() at module load — one code
// path, one error-handling behavior: throw and let startup fail loudly.
const connectDB = async () => {
  await sequelize.authenticate();
  logger.info('Database connection established successfully.');
  return sequelize;
};

module.exports = { sequelize, connectDB };
