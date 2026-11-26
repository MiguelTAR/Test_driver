const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  throw new Error('Copy .env.example to .env before generating the API secret.');
}

let envText = fs.readFileSync(envPath, 'utf8');
const currentSecret = envText.match(/^JWT_SECRET=(.*)$/m)?.[1]?.trim();
if (
  currentSecret &&
  currentSecret !== 'replace_with_a_random_64_character_secret'
) {
  console.log('JWT_SECRET is already configured.');
  process.exit(0);
}

const secret = crypto.randomBytes(32).toString('hex');
if (/^JWT_SECRET=.*$/m.test(envText)) {
  envText = envText.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
} else {
  envText = `${envText.trimEnd()}\nJWT_SECRET=${secret}\n`;
}
fs.writeFileSync(envPath, envText);
console.log('Generated a JWT signing secret in .env.');
