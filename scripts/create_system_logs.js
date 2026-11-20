const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      level ENUM('info', 'warn', 'error') NOT NULL DEFAULT 'info',
      category VARCHAR(50) NOT NULL COMMENT 'ssh, auth, deploy, config, system',
      action VARCHAR(100) NOT NULL COMMENT 'connect, test-connection, login, etc.',
      message TEXT NOT NULL,
      detail TEXT DEFAULT NULL COMMENT 'Stack trace or extra detail',
      target_host VARCHAR(100) DEFAULT NULL,
      user_id INT DEFAULT NULL,
      username VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_level (level),
      INDEX idx_category (category),
      INDEX idx_created_at (created_at),
      INDEX idx_target_host (target_host)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('system_logs table created successfully');

  const [rows] = await pool.query('DESCRIBE system_logs');
  console.table(rows.map(r => ({ Field: r.Field, Type: r.Type, Key: r.Key })));

  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
