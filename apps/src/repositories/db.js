import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resuelve .env en apps/.env sin depender del cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// normaliza flags
const toBool = (v) => ['true', '1', 'yes', 'on'].includes(String(v).toLowerCase());
const useSSL = toBool(process.env.DB_SSL);

// compat: usa vars de Railway si existen, o las DB_ de tu .env
const cfg = {
  host: process.env.MYSQLHOST || process.env.DB_HOST,
  port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
  user: process.env.MYSQLUSER || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // ---- FIX SSL PARA RAILWAY 🔥 ----
  ssl: useSSL
    ? {
        rejectUnauthorized: false // <––– Clave total
      }
    : undefined,

  timezone: 'Z',
  dateStrings: true
};

export const pool = mysql.createPool(cfg);

// helper para repos
export async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
