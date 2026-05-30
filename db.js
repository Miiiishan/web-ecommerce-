const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST || "sql12.freesqldatabase.com",
  user: process.env.DB_USER || "sql12828718",
  password: process.env.DB_PASSWORD || "rRT1eRRrFP",
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
