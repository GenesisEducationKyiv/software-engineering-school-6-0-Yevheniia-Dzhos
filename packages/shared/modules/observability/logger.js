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

export function createLogger(service) {
  function writeLog(level, message, context = {}) {
    if (levels[level] < getMinimumLevel()) return;

    const { error, ...fields } = context;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      ...fields
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

  return {
    debug: (message, context) => writeLog('debug', message, context),
    info: (message, context) => writeLog('info', message, context),
    warn: (message, context) => writeLog('warn', message, context),
    error: (message, context) => writeLog('error', message, context)
  };
}

export const logger = createLogger('github-release-notifier');
