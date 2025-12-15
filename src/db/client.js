const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const ssl = process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined;

// A single shared connection pool for the API. Reuses TCP connections across resolvers.
const pool = new Pool({ connectionString, ssl });

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
