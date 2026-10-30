const fs = require('node:fs');
const dotenv = require('../backend/node_modules/dotenv');
const { resolveMongoUri } = require('../backend/services/databaseConfig');

try {
  const output = process.argv[2] === '--write' ? process.argv[3] : null;
  if (process.argv[2] === '--write' && !output) throw new Error('Output environment file path is required.');
  const source = !output && process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : process.env.BACKEND_ENV;
  if (!source?.trim()) throw new Error('BACKEND_ENV must contain the complete backend .env file.');
  const env = dotenv.parse(source);
  const cloudinaryKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  for (const key of cloudinaryKeys) {
    if (process.env[key]?.trim()) env[key] = process.env[key].trim();
  }
  const hasCloudinaryConfig = cloudinaryKeys.some(key => env[key]?.trim());
  const cloudinaryConfigured = cloudinaryKeys.every(key => env[key]?.trim() && !/^your_/i.test(env[key].trim()));
  if (hasCloudinaryConfig && !cloudinaryConfigured) {
    throw new Error('Cloudinary configuration is incomplete or still contains placeholders; provide cloud name, API key and API secret.');
  }
  if (process.env.REQUIRE_CLOUDINARY === 'true' && !cloudinaryConfigured) {
    throw new Error('Cloudinary credentials are required. Add them to BACKEND_ENV or configure the three Cloudinary Actions secrets.');
  }
  if (process.env.ATLAS_MONGODB_URI?.trim()) env.MONGODB_URI = process.env.ATLAS_MONGODB_URI;
  const uri = resolveMongoUri(env);
  if (!env.JWT_SECRET?.trim()) throw new Error('JWT_SECRET is missing from BACKEND_ENV.');
  const smsCredentials = [
    env.SMS_USERNAME,
    env.SMS_PASSWORD || env.SMS_API_KEY,
    env.SMS_SENDER_ID,
    env.SMS_TEMPLATE_ID,
  ];
  if (!smsCredentials.every(value => value?.trim() && !/^your_/i.test(value.trim()))) {
    throw new Error('Live OTP delivery requires SMS_USERNAME, SMS_PASSWORD (or SMS_API_KEY), SMS_SENDER_ID and SMS_TEMPLATE_ID in BACKEND_ENV.');
  }
  let smsEndpoint;
  try { smsEndpoint = new URL(env.SMS_API_URL); } catch {}
  if (!smsEndpoint || smsEndpoint.protocol !== 'https:' || /\.example$/i.test(smsEndpoint.hostname)) {
    throw new Error('SMS_API_URL must be a valid HTTPS SMS provider endpoint.');
  }
  if (output) {
    // Single quotes preserve literal dollar signs in Docker Compose env files.
    const outputSource = cloudinaryConfigured
      ? source.split(/\r?\n/).filter(line => !cloudinaryKeys.some(key => new RegExp(`^\\s*${key}\\s*=`).test(line))).join('\n').trimEnd()
      : source.trimEnd();
    const cloudinaryEnv = cloudinaryConfigured
      ? `\n${cloudinaryKeys.map(key => `${key}='${env[key].replace(/'/g, '%27')}'`).join('\n')}\n`
      : '\n';
    fs.writeFileSync(output, `${outputSource}\n${cloudinaryEnv}MONGODB_URI='${uri.replace(/'/g, '%27')}'\nPORT=2001\n`, { mode: 0o600 });
  }
  console.log(`Backend environment validated. MongoDB URI and JWT secret are present; Cloudinary ${cloudinaryConfigured ? 'is configured' : 'is not configured'}; values are hidden.`);
} catch (error) {
  console.error(`Backend environment validation failed: ${error.message}`);
  process.exitCode = 1;
}
