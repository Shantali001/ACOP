import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { createCampaign, getCampaign, updateCampaign } from '../campaigns/api';
import type { CampaignInput } from '../campaigns/types';
import { Card } from '../components/ui/Card';

export function CampaignCreateEditPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    setIsLoading(true);
    getCampaign(token, id)
      .then((campaign) => {
        setName(campaign.campaignName);
        setDescription(campaign.description ?? '');
        setStartDate(campaign.startDate ?? '');
        setEndDate(campaign.endDate ?? '');
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : 'Unable to load campaign.'))
      .finally(() => setIsLoading(false));
  }, [id, token]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const payload: CampaignInput = {
      campaignName: name,
      description: description || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    try {
      const campaign = id ? await updateCampaign(token, id, payload) : await createCampaign(token, payload);
      navigate(`/admin/campaigns/${campaign.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save campaign.');
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-page font-bold text-ink">{id ? 'Edit campaign' : 'Create campaign'}</h1>
          <p className="mt-2 text-body text-ink-secondary">
            {id ? 'Update campaign details and schedule.' : 'Set up a new campaign.'}
          </p>
        </div>
        {id && (
          <Link to={`/admin/campaigns/${id}`} className="btn btn-secondary gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        )}
      </div>

      {error && (
        <div className="card">
          <div className="px-6 py-4 text-sm text-danger" role="alert">
            {error}
          </div>
        </div>
      )}

      <Card>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-body text-ink-secondary">Campaign name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-2" required />
          </label>

          <label className="block">
            <span className="text-body text-ink-secondary">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input mt-2" rows={4} />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-body text-ink-secondary">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input mt-2" />
            </label>
            <label className="block">
              <span className="text-body text-ink-secondary">End date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-2" />
            </label>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isLoading} className="btn btn-primary">
              {isLoading ? 'Saving...' : id ? 'Save changes' : 'Create campaign'}
            </button>
          </div>
        </form>
      </Card>
    </section>
  );
}
