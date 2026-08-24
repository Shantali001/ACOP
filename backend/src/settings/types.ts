export type PasswordPolicy = {
  minLength: number;
  requireNumbers: boolean;
  requireSymbols: boolean;
};

export type SettingsRow = {
  organization_name: string;
  organization_logo: string | null;
  theme: string;
  backup_enabled: boolean;
  password_policy: PasswordPolicy;
  updated_at: string;
};