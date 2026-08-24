import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  Palette,
  ShieldCheck,
  CloudBackup,
  Image,
  Save,
  Building2,
  Trash2,
} from 'lucide-react';

import logoUrl from '../assets/amsaf-logo.png';
import { useAuth } from '../auth/useAuth';
import { getSettings, updateSettings } from '../settings/api';
import type { SystemSettings } from '../settings/types';
import { Skeleton } from '../components/ui/Skeleton';

const defaultSettings: SystemSettings = {
  organizationName: 'AMSAF',
  organizationLogo: null,
  theme: 'light',
  backupEnabled: false,
  passwordPolicy: {
    minLength: 8,
    requireNumbers: false,
    requireSymbols: false,
  },
  updatedAt: '',
};

export function SettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    getSettings()
      .then(setSettings)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Could not load settings.')
      )
      .finally(() => setIsLoading(false));
  }, []);

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Logo must be an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSettings((current) => ({ ...current, organizationLogo: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await updateSettings(token, {
        organizationName: settings.organizationName,
        organizationLogo: settings.organizationLogo,
        theme: settings.theme,
        backupEnabled: settings.backupEnabled,
        passwordPolicy: settings.passwordPolicy,
      });
      setSettings(updated);
      setMessage('Settings saved. Reload open pages to see branding updates everywhere.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save settings.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-page text-ink">System Settings</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Manage organization branding, theme, password policy and backup preferences.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger-light bg-danger-light px-4 py-3 text-body text-danger">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-success-light bg-success-light px-4 py-3 text-body text-success">
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="card card-hover p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <h2 className="text-section text-ink">Branding</h2>
            </div>
            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="text-body text-ink-secondary">Organization name</span>
                <input
                  value={settings.organizationName}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, organizationName: event.target.value }))
                  }
                  className="input mt-2"
                  required
                />
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <img
                  src={settings.organizationLogo ?? logoUrl}
                  alt="Organization logo preview"
                  className="h-16 w-16 rounded-xl border border-border object-contain"
                />
                <div className="flex flex-col gap-3">
                  <label className="btn btn-secondary cursor-pointer">
                    <Image className="h-4 w-4" />
                    Replace logo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void handleLogoChange(event)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((current) => ({ ...current, organizationLogo: null }))
                    }
                    className="btn btn-ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                    Use default
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card card-hover p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Palette className="h-5 w-5" />
              </div>
              <h2 className="text-section text-ink">Appearance</h2>
            </div>
            <div className="mt-6">
              <label className="block">
                <span className="text-body text-ink-secondary">Theme</span>
                <select
                  value={settings.theme}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, theme: event.target.value }))
                  }
                  className="input mt-2"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="green">AMSAF Green</option>
                  <option value="gold">AMSAF Gold</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card card-hover p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-section text-ink">Password Policy</h2>
            </div>
            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="text-body text-ink-secondary">Minimum length</span>
                <input
                  type="number"
                  min={6}
                  value={settings.passwordPolicy.minLength}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      passwordPolicy: {
                        ...current.passwordPolicy,
                        minLength: Number(event.target.value),
                      },
                    }))
                  }
                  className="input mt-2"
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:bg-hover">
                <input
                  type="checkbox"
                  checked={settings.passwordPolicy.requireNumbers}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      passwordPolicy: {
                        ...current.passwordPolicy,
                        requireNumbers: event.target.checked,
                      },
                    }))
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-body text-ink">Require numbers</span>
                  <p className="text-sm text-ink-muted">
                    Passwords must include at least one numeric character.
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:bg-hover">
                <input
                  type="checkbox"
                  checked={settings.passwordPolicy.requireSymbols}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      passwordPolicy: {
                        ...current.passwordPolicy,
                        requireSymbols: event.target.checked,
                      },
                    }))
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-body text-ink">Require symbols</span>
                  <p className="text-sm text-ink-muted">
                    Passwords must include at least one special character.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="card card-hover p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
                <CloudBackup className="h-5 w-5" />
              </div>
              <h2 className="text-section text-ink">Backup</h2>
            </div>
            <div className="mt-6">
              <label className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:bg-hover">
                <input
                  type="checkbox"
                  checked={settings.backupEnabled}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, backupEnabled: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-body text-ink">Enable scheduled backups</span>
                  <p className="text-sm text-ink-muted">
                    Automatically create system backups on a regular schedule.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-body text-ink-muted">
              Last updated:{' '}
              {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'Never'}
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
