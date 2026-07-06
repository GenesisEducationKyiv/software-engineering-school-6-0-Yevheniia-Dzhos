const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function getMinimumLevel() {
  const configuredLevel = process.env.LOG_LEVEL || 'info';

  return levels[configuredLevel] || levels.info;
}

function serializeError(error) {
  if (!error) return undefined;

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

function isSensitiveKey(key) {
  const normalizedKey = key.toLowerCase();

  return (
    normalizedKey.includes('token') ||
    normalizedKey.includes('secret') ||
    normalizedKey.includes('password') ||
    normalizedKey.includes('passwd') ||
    normalizedKey.includes('passphrase') ||
    normalizedKey.includes('apikey') ||
    normalizedKey.includes('api_key') ||
    normalizedKey.includes('api-key') ||
    normalizedKey.includes('authorization') ||
    normalizedKey.includes('cookie') ||
    normalizedKey === 'pass' ||
    normalizedKey.endsWith('pass')
  );
}

function sanitizeLogValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        isSensitiveKey(key) ? '[REDACTED]' : sanitizeLogValue(nestedValue)
      ])
    );
  }

  return value;
}

function writeLog(level, message, context = {}) {
  if (levels[level] < getMinimumLevel()) return;

  const { error, ...fields } = context;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'github-release-notifier',
    message,
    ...sanitizeLogValue(fields)
  };

  if (error) {
    entry.error = serializeError(error);
  }

  const output = JSON.stringify(entry);

  if (level === 'error') {
    process.stderr.write(`${output}\n`);
    return;
  }

  process.stdout.write(`${output}\n`);
}

export const logger = {
  debug: (message, context) => writeLog('debug', message, context),
  info: (message, context) => writeLog('info', message, context),
  warn: (message, context) => writeLog('warn', message, context),
  error: (message, context) => writeLog('error', message, context)
};