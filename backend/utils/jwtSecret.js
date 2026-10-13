// One place for the token-signing secret. Production must provide JWT_SECRET: a secret that is
// written in the source code could be used by anyone to forge an admin login.
const DEV_FALLBACK = 'mahabaleshwar_secret_key_2026';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set. Set a long random value before running in production.');
  }
  return DEV_FALLBACK;
}

// Fail at startup (not on the first login) when production is misconfigured.
if (process.env.NODE_ENV === 'production') getJwtSecret();

module.exports = { getJwtSecret };
