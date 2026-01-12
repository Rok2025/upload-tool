import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// For script execution outside of Next.js
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 5836,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'upload_tool',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
