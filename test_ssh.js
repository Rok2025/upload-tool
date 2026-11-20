const { Client } = require('ssh2');
const CryptoJS = require('crypto-js');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const pool = await mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const [rows] = await pool.query(
    'SELECT host, port, username, password_encrypted FROM environments WHERE id = 5'
  );
  const env = rows[0];

  // Decrypt password using CryptoJS (same as the app)
  const SECRET_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key';
  const bytes = CryptoJS.AES.decrypt(env.password_encrypted, SECRET_KEY);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);

  console.log('Connecting to:', env.host + ':' + env.port, 'user:', env.username);
  console.log('Password length:', decrypted.length);

  const c = new Client();
  console.time('total');
  c.on('ready', () => {
    console.timeEnd('total');
    console.log('SUCCESS - connected!');
    c.exec('whoami', (err, stream) => {
      if (err) { console.log('exec error:', err); c.end(); return; }
      stream.on('data', (d) => console.log('whoami:', d.toString().trim()));
      stream.on('close', () => { c.end(); process.exit(0); });
    });
  })
  .on('error', (err) => {
    console.timeEnd('total');
    console.log('ERROR:', err.message, '| level:', err.level);
    process.exit(1);
  })
  .connect({
    host: env.host,
    port: env.port,
    username: env.username,
    password: decrypted,
    readyTimeout: 15000,
  });

  await pool.end();
})();
