// db.js — PostgreSQL connection pool
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = pool;
