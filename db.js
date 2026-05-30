const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Mishaeld0751",  // 👈 change this
  database: "my_app"               // 👈 we will create this
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