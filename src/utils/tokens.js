import crypto from 'node:crypto';
export function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}
