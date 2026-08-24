import type { AgentInput } from './types.js';

export function validateAgentInput(body: Record<string, unknown>) {
  const agent: AgentInput = {
    fullName: typeof body.fullName === 'string' ? body.fullName.trim() : '',
    email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : '',
  };

  const errors: string[] = [];

  if (!agent.fullName) {
    errors.push('Full name is required.');
  }

  if (!agent.email) {
    errors.push('Email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agent.email)) {
    errors.push('A valid email address is required.');
  }

  return { agent, errors };
}