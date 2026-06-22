// src/config/database.ts
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let poolConfig: PoolConfig;

if (process.env.DATABASE_URL) {
  // Railway / production: use connection string
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
} else {
  // Local development / cPanel: use individual env vars
  poolConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'db_alfath_skin',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    // cPanel PostgreSQL does not support SSL; use plain TCP via IPv4 (127.0.0.1)
    ssl: false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

export const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

// Query helper
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
