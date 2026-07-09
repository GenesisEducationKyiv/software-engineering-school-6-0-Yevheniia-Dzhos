export function getRequiredEnv(name) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getOptionalEnv(name, defaultValue) {
  return process.env[name] ?? defaultValue;
}

export function getPositiveIntegerEnv(name, defaultValue) {
  const value = getOptionalEnv(name, defaultValue);
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return parsed;
}

export function getPortEnv(name, defaultValue) {
  const port = getPositiveIntegerEnv(name, defaultValue);

  if (port > 65535) {
    throw new Error(`Environment variable ${name} must be a valid port`);
  }

  return port;
}

export function getBooleanEnv(name, defaultValue = false) {
  const value = getOptionalEnv(name, String(defaultValue)).toLowerCase();

  if (value !== 'true' && value !== 'false') {
    throw new Error(`Environment variable ${name} must be true or false`);
  }

  return value === 'true';
}

