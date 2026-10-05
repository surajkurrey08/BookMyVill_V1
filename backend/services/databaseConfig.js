const { MongoClient } = require('mongoose').mongo;

function cleanValue(value) {
  let text = String(value || '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1).trim();
  return text;
}

function resolveMongoUri(env = process.env) {
  const keys = ['MONGODB_URI', 'MONGO_URI', 'MONGO_URL', 'MONGODB_FALLBACK_URI'];
  const key = keys.find(name => cleanValue(env[name]));
  if (!key) throw new Error('MongoDB URI is missing. Set MONGODB_URI in BACKEND_ENV.');
  const uri = cleanValue(env[key]);
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error(`${key} is invalid. It must start with mongodb:// or mongodb+srv://. Update the GitHub BACKEND_ENV secret.`);
  }
  try {
    // Parse the connection string without connecting or exposing credentials.
    new MongoClient(uri);
  } catch {
    throw new Error(`${key} is malformed. Use the MongoDB connection string with URL-encoded credentials in BACKEND_ENV.`);
  }
  return uri;
}

module.exports = { resolveMongoUri };
