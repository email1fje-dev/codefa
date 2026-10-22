const { Pool } = require('pg');
const production = process.env.NODE_ENV === 'production';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: production ? { rejectUnauthorized: false } : false, max: 8, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
pool.on('error', err => console.error('خطای اتصال دیتابیس:', err.message));
module.exports = pool;
