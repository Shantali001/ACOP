import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { createAgent, listAgents, updateAgent } from '../agents/api';
import type { AgentInput } from '../agents/types';
import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';

export function AgentCreateEditPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ fullName?: string; email?: string }>({});

  useEffect(() => {
    if (!token || !id) return;

    setIsLoading(true);
    listAgents(token)
      .then((agents) => {
        const agent = agents.find((item) => item.id === id);
        if (!agent) throw new Error('Agent not found.');
        setFullName(agent.fullName);
        setEmail(agent.email);
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : 'Unable to load agent.'))
      .finally(() => setIsLoading(false));
  }, [id, token]);

  function validate() {
    const next: { fullName?: string; email?: string } = {};
    if (!fullName.trim()) next.fullName = 'Full name is required.';
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.';
    setValidationErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !validate()) return;

    const payload: AgentInput = { fullName, email };
    setIsSaving(true);
    setError(null);
    setTemporaryPassword(null);

    try {
      if (id) {
        await updateAgent(token, id, payload);
        navigate('/admin/agents');
      } else {
        const result = await createAgent(token, payload);
        setTemporaryPassword(result.temporaryPassword);
        setFullName(result.agent.fullName);
        setEmail(result.agent.email);
        setValidationErrors({});
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save agent.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="py-6">
      <div className="mb-6">
        <h1 className="text-section font-semibold text-ink">{id ? 'Edit agent' : 'Add agent'}</h1>
        <p className="mt-1 text-body text-ink-secondary">Agent users sign in with the email address set here.</p>
      </div>

      {error && (
        <div className="mb-6 card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {error}
          </div>
        </div>
      )}

      {temporaryPassword && (
        <div className="mb-6 card">
          <div className="px-6 py-4 text-sm text-success">
            Temporary password: <span className="font-semibold">{temporaryPassword}</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card">
          <div className="px-6 py-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Skeleton height={16} width={80} className="mb-2" />
                <Skeleton height={40} />
              </div>
              <div>
                <Skeleton height={16} width={60} className="mb-2" />
                <Skeleton height={40} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Card
          title={id ? 'Agent details' : 'New agent'}
          description={id ? 'Update the agent profile below.' : 'Fill in the details to create an agent.'}
        >
          <form className="mt-6" onSubmit={handleSubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-secondary">Full name</span>
                <input
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    if (validationErrors.fullName) setValidationErrors((prev) => ({ ...prev, fullName: undefined }));
                  }}
                  className={`input ${validationErrors.fullName ? 'input-error' : ''}`}
                  required
                />
                {validationErrors.fullName && (
                  <p className="mt-2 text-sm text-danger">{validationErrors.fullName}</p>
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-secondary">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (validationErrors.email) setValidationErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={`input ${validationErrors.email ? 'input-error' : ''}`}
                  required
                />
                {validationErrors.email && (
                  <p className="mt-2 text-sm text-danger">{validationErrors.email}</p>
                )}
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <button type="submit" disabled={isSaving} className="btn btn-primary">
                {isSaving ? 'Saving...' : id ? 'Save changes' : 'Create agent'}
              </button>
              <button type="button" onClick={() => navigate('/admin/agents')} className="btn btn-secondary">
                Back
              </button>
            </div>
          </form>
        </Card>
      )}
    </section>
  );
}
