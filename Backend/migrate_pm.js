const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query("ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'online'"))
  .then(() => { console.log('Migration applied: payment_method column added'); c.end(); })
  .catch(e => { console.error('Migration error:', e.message); c.end(); process.exit(1); });
