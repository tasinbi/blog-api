const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4' // Support for Bangla characters
});

// Test database connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully');
    // Set charset for the connection
    connection.query("SET NAMES 'utf8mb4'", (err) => {
      if (err) console.error('Error setting charset:', err);
    });
    connection.release();
  }
});

module.exports = pool.promise();