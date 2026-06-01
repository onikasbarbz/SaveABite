const { Pool } = require("pg");
require("dotenv").config();

// Initialize the Pool using .env variables
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "luniva",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "saveabite_app",
  // Standard PostgreSQL port is 5432. We use Number() to ensure it's not a string.
  port: Number(process.env.DB_PORT) || 5432, 
  connectionTimeoutMillis: 2000,
});

// --- CONNECTION LOGGING ---

// Success log
pool.on("connect", () => {
  // This only triggers when a query is actually made
  console.log("🐘 Connected to PostgreSQL database successfully.");
});

// Error log for idle clients
pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle PostgreSQL client:", err.message);
});

// Immediate startup check to verify parameters
const checkConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("--------------------------------------------------");
    console.log(`📡 DATABASE STATUS: ONLINE`);
    console.log(`🏠 Host: ${process.env.DB_HOST}`);
    console.log(`🔌 Port: ${process.env.DB_PORT || 5432}`);
    console.log(`📁 Database: ${process.env.DB_NAME}`);
    console.log("--------------------------------------------------");
    client.release();
  } catch (err) {
    console.error("--------------------------------------------------");
    console.error("🚨 DATABASE CONNECTION ERROR!");
    console.error("Check if PostgreSQL is running: 'brew services list'");
    console.error("Error Detail:", err.message);
    console.error("--------------------------------------------------");
  }
};

checkConnection();

module.exports = pool;