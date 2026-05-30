const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Mishaeld0751",
  database: process.env.DB_NAME || "my_app",
  port: process.env.DB_PORT || 3306
});

db.connect((err) => {

  if (err) {
    console.log("❌ DB CONNECTION FAILED");
    console.log(err.message);
    return;
  }

  console.log("✅ DATABASE CONNECTED SUCCESSFULLY");

});

module.exports = db;
