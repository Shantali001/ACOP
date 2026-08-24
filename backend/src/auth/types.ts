export type UserRole = 'ADMIN' | 'AGENT' | 'SUPERVISOR';

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  jti: string;
  exp: number;
};
