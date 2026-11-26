require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = Number(process.env.MYSQL_PORT || 3306);
const database = process.env.MYSQL_DATABASE || 'driver_analytics';
const appUser = process.env.MYSQL_USER || 'driver_app';
const adminUser = process.env.MYSQL_ADMIN_USER || 'root';
const adminPassword =
  process.env.MYSQL_ADMIN_PASSWORD &&
  process.env.MYSQL_ADMIN_PASSWORD !== 'replace_with_your_existing_mysql_root_password'
    ? process.env.MYSQL_ADMIN_PASSWORD
    : '';

async function setup() {
  const appPassword =
    process.env.MYSQL_PASSWORD &&
    process.env.MYSQL_PASSWORD !== 'replace_with_generated_password'
      ? process.env.MYSQL_PASSWORD
      : crypto.randomBytes(32).toString('base64url');
  const jwtSecret =
    process.env.JWT_SECRET &&
    process.env.JWT_SECRET !== 'replace_with_a_random_64_character_secret'
      ? process.env.JWT_SECRET
      : crypto.randomBytes(32).toString('hex');

  const admin = await mysql.createConnection({
    host,
    port,
    user: adminUser,
    password: adminPassword,
  });

  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );

  for (const accountHost of ['localhost', '%']) {
    await admin.query(
      `CREATE USER IF NOT EXISTS \`${appUser}\`@\`${accountHost}\`
       IDENTIFIED BY ${mysql.escape(appPassword)}`
    );
    await admin.query(
      `ALTER USER \`${appUser}\`@\`${accountHost}\`
       IDENTIFIED BY ${mysql.escape(appPassword)}`
    );
  }

  await admin.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
     ON \`${database}\`.* TO \`${appUser}\`@\`localhost\``
  );
  await admin.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
     ON \`${database}\`.* TO \`${appUser}\`@\`%\``
  );
  await admin.query('FLUSH PRIVILEGES');
  await admin.end();

  const envPath = path.join(__dirname, '..', '.env');
  let envText = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8')
    : fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');

  envText = envText.replace(
    /^MYSQL_PASSWORD=.*$/m,
    `MYSQL_PASSWORD=${appPassword}`
  );
  envText = envText.replace(
    /^MYSQL_ADMIN_PASSWORD=.*$/m,
    'MYSQL_ADMIN_PASSWORD='
  );
  envText = envText.replace(
    /^JWT_SECRET=.*$/m,
    `JWT_SECRET=${jwtSecret}`
  );
  fs.writeFileSync(envPath, envText);

  console.log(
    `Created database "${database}" and dedicated account "${appUser}".`
  );
  console.log('App credentials and the API signing secret were saved in .env; the admin password was cleared.');
}

setup().catch((error) => {
  console.error('MySQL setup failed:', error.message);
  process.exit(1);
});
