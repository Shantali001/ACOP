import crypto from 'node:crypto';

import { env } from '../config/env.js';
import type { AuthenticatedUser, UserRole } from './types.js';

type TokenPayload = {
  sub: string;
  fullName: string;
  email: string;
  role: UserRole;
  jti: string;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string) {
  return crypto
    .createHmac('sha256', encoder.encode(env.jwtSecret))
    .update(data)
    .digest('base64url');
}

export function createToken(user: Omit<AuthenticatedUser, 'jti' | 'exp'>) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + env.jwtExpiresInSeconds;
  const payload: TokenPayload = {
    sub: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    jti: crypto.randomUUID(),
    iat,
    exp,
  };
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;

  return {
    token: `${unsigned}.${sign(unsigned)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
    payload,
  };
}

export function verifyToken(token: string): AuthenticatedUser {
  const [encodedHeader, encodedPayload, signature] = token.split('.');

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error('Malformed token');
  }

  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = sign(unsigned);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as TokenPayload;

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return {
    id: payload.sub,
    fullName: payload.fullName,
    email: payload.email,
    role: payload.role,
    jti: payload.jti,
    exp: payload.exp,
  };
}
