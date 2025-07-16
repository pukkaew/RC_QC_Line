// Database configuration
const sql = require('mssql');

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: true, // For local dev
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

module.exports = {
  config: dbConfig,
  
  // Create a new connection pool
  createPool: async () => {
    try {
      const pool = await sql.connect(dbConfig);
      return pool;
    } catch (error) {
      console.error('Error connecting to database:', error);
      throw error;
    }
  }
};