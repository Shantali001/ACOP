const revokedTokens = new Map<string, number>();

function pruneExpiredRevocations() {
  const now = Math.floor(Date.now() / 1000);

  for (const [jti, exp] of revokedTokens) {
    if (exp <= now) {
      revokedTokens.delete(jti);
    }
  }
}

export function revokeToken(jti: string, exp: number) {
  pruneExpiredRevocations();
  revokedTokens.set(jti, exp);
}

export function isTokenRevoked(jti: string) {
  pruneExpiredRevocations();

  return revokedTokens.has(jti);
}
