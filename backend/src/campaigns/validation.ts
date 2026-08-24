import type { CampaignInput } from './types.js';

export function validateCampaignInput(body: Record<string, unknown>) {
  const campaign: CampaignInput = {
    campaignName: typeof body.campaignName === 'string' ? body.campaignName.trim() : '',
    description: typeof body.description === 'string' ? body.description.trim() : null,
    startDate: typeof body.startDate === 'string' ? body.startDate.trim() : null,
    endDate: typeof body.endDate === 'string' ? body.endDate.trim() : null,
  };

  const errors: string[] = [];
  if (!campaign.campaignName) {
    errors.push('Campaign name is required.');
  }

  return { campaign, errors };
}
