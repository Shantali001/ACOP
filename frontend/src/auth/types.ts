export type UserRole = 'ADMIN' | 'AGENT' | 'SUPERVISOR';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

export type LoginResponse = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};
