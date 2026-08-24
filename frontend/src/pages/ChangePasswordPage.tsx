import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';

import { changePassword } from '../auth/api';
import { useAuth } from '../auth/useAuth';

export function ChangePasswordPage() {
  const { token, clearSession } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword(token, currentPassword, newPassword);
      clearSession();
      navigate('/login', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Password change failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg">
      <div className="card p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-page text-ink">Change password</h1>
            <p className="mt-0.5 text-body text-ink-secondary">
              Update your account password.
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl border border-danger-light bg-danger-light px-4 py-3 text-body text-danger">
              {error}
            </div>
          )}

          <label className="block">
            <span className="text-body text-ink-secondary">Current password</span>
            <div className="relative mt-2">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="input pr-10"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="text-body text-ink-secondary">New password</span>
            <div className="relative mt-2">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="input pr-10"
                autoComplete="new-password"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="text-body text-ink-secondary">Confirm new password</span>
            <div className="relative mt-2">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input pr-10"
                autoComplete="new-password"
                required
              />
            </div>
          </label>

          <label className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowPasswords((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-ink-muted transition hover:bg-hover hover:text-ink"
              title={showPasswords ? 'Hide passwords' : 'Show passwords'}
            >
              {showPasswords ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
            <span className="text-body text-ink-secondary">Show passwords</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full"
          >
            <Lock className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : 'Update password'}
          </button>
        </form>
      </div>
    </section>
  );
}
