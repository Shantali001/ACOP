import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { isAuthenticated, login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated && user) {
    return (
      <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/agent/dashboard'} replace />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const loggedInUser = await login(email, password);
      const fallbackPath = loggedInUser.role === 'ADMIN' ? '/admin/dashboard' : '/agent/dashboard';
      const state = location.state as { from?: { pathname?: string } } | null;
      navigate(state?.from?.pathname ?? fallbackPath, { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo showText />
        </div>
        <div className="card">
          <div className="px-6 pb-6 pt-6">
            <h1 className="text-page font-bold text-ink">Sign in</h1>
            <p className="mt-2 text-body text-ink-muted">Enter your credentials to access your account.</p>
          </div>
          <form className="px-6 pb-6" onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 rounded-lg border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-secondary">Email</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-secondary">Password</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary mt-6 w-full"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
