export type PasswordPolicy = {
  minLength: number;
  requireNumbers: boolean;
  requireSymbols: boolean;
};

export type SystemSettings = {
  organizationName: string;
  organizationLogo: string | null;
  theme: string;
  backupEnabled: boolean;
  passwordPolicy: PasswordPolicy;
  updatedAt: string;
};