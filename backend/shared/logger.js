// Structured JSON logger shared by the API Gateway and every microservice.
// One line per event: { timestamp, service, level, msg, ...fields }.
// Secrets are redacted by key name and connection strings are masked.

const SECRET_KEYS = /pass(word)?|secret|token|authorization|cookie|otp|signature|mongodb_uri|api[_-]?key/i;
const URI_CREDENTIALS = /(\w+:\/\/)([^:@/\s]+):([^@/\s]+)@/g;

function redact(value, depth = 0) {
  if (value === null || value === undefined || depth > 4) return value;
  if (typeof value === 'string') return value.replace(URI_CREDENTIALS, '$1$2:***@');
  if (value instanceof Error) return { name: value.name, message: redact(value.message), ...(value.status && { status: value.status }) };
  if (Array.isArray(value)) return value.slice(0, 20).map(item => redact(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEYS.test(key) ? '[redacted]' : redact(item, depth + 1)]));
  }
  return value;
}

// LOG_LEVEL: debug | info (default) | warn | error | silent.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const enabled = level => LEVELS[level] >= (LEVELS[process.env.LOG_LEVEL] || LEVELS.info);

function createLogger(service = process.env.SERVICE_NAME || 'bookmyvilla') {
  const write = (level, msg, fields = {}) => {
    if (!enabled(level)) return;
    const line = JSON.stringify({ timestamp: new Date().toISOString(), service, level, msg, ...redact(fields) });
    (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
  };
  return {
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
    debug: (msg, fields) => write('debug', msg, fields),
    child: name => createLogger(`${service}:${name}`)
  };
}

module.exports = { createLogger, redact };
