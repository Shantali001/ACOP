import crypto from 'node:crypto';

const temporaryPasswordCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%';

export function createTemporaryPassword(length = 14) {
  let password = '';

  for (let index = 0; index < length; index += 1) {
    const randomIndex = crypto.randomInt(temporaryPasswordCharacters.length);
    password += temporaryPasswordCharacters[randomIndex];
  }

  return password;
}

export function assertPasswordStrength(password: string) {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
}
