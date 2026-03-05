const mysql = require("mysql2/promise");

let pool;

async function initDb() {
  const {
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
  } = process.env;

  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) {
    // For the purposes of the assignment we still expose MySQL integration,
    // but allow the app to run in a demo mode without an actual DB.
    // eslint-disable-next-line no-console
    console.warn(
      "MySQL environment variables not fully set. Running in DEMO mode with in-memory data only."
    );
    return null;
  }

  if (!pool) {
    pool = mysql.createPool({
      host: MYSQL_HOST,
      port: MYSQL_PORT || 3306,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  // Simple sanity check query
  await pool.query("SELECT 1");
  return pool;
}

function getPool() {
  if (!pool) {
    throw new Error("MySQL pool not initialized. Call initDb() first.");
  }
  return pool;
}

module.exports = {
  initDb,
  getPool,
};

