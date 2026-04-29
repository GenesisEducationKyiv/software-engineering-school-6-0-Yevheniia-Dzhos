const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const repoRegex = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function isValidEmail(email) {
  return emailRegex.test(String(email || '').trim());
}

export function isValidRepo(repo) {
  return repoRegex.test(String(repo || '').trim());
}

export function isValidToken(token) {
  return typeof token === 'string' && token.trim().length >= 10;
}
