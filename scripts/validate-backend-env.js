const fs = require('node:fs');
const dotenv = require('../backend/node_modules/dotenv');
const { resolveMongoUri } = require('../backend/services/databaseConfig');

try {
  const output = process.argv[2] === '--write' ? process.argv[3] : null;
  if (process.argv[2] === '--write' && !output) throw new Error('Output environment file path is required.');
  const source = !output && process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : process.env.BACKEND_ENV;
  if (!source?.trim()) throw new Error('BACKEND_ENV must contain the complete backend .env file.');
  const env = dotenv.parse(source);
  if (process.env.ATLAS_MONGODB_URI?.trim()) env.MONGODB_URI = process.env.ATLAS_MONGODB_URI;
  const uri = resolveMongoUri(env);
  if (!env.JWT_SECRET?.trim()) throw new Error('JWT_SECRET is missing from BACKEND_ENV.');
  if (output) {
    // Single quotes preserve literal dollar signs in Docker Compose env files.
    fs.writeFileSync(output, `${source.trimEnd()}\nMONGODB_URI='${uri.replace(/'/g, '%27')}'\nPORT=2001\n`, { mode: 0o600 });
  }
  console.log('Backend environment validated. MongoDB URI and JWT secret are present; values are hidden.');
} catch (error) {
  console.error(`Backend environment validation failed: ${error.message}`);
  process.exitCode = 1;
}
