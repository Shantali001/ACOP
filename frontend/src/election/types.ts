export type PollingUnit = {
  id: string;
  puCode: string;
  puName: string;
  ward: string;
  lga: string;
  state: string;
  registeredVoters: number;
  fieldAgentName: string | null;
  fieldAgentPhone: string | null;
  createdAt: string;
};

export type PartyCandidate = {
  id: string;
  name: string;
  partyCode: string | null;
  isOurParty: boolean;
  sortOrder: number;
};

export type ElectionAssignment = {
  id: string;
  pollingUnitId: string;
  agentId: string;
  status: string;
  checkInIntervalMinutes: number;
  lastCalledAt: string | null;
  createdAt: string;
};

export type PollingUnitReport = {
  id: string;
  pollingUnitId: string;
  agentId: string;
  reportType: string;
  accreditedVoters: number | null;
  notes: string | null;
  submittedAt: string;
};

export type Incident = {
  id: string;
  pollingUnitId: string;
  reportId: string | null;
  category: string;
  severity: string;
  description: string | null;
  agentId: string;
  createdAt: string;
};

export type ElectionTarget = {
  id: string;
  scopeLevel: string;
  scopeValue: string | null;
  votesNeededToWin: number;
  expectedTurnoutPercent: number;
  createdAt: string;
  updatedAt: string;
};

export type SituationRoomSummary = {
  totalPus: number;
  pusReported: number;
  totalRegisteredVoters: number;
  totalAccreditedVoters: number;
  coveragePercent: number;
  turnoutPercent: number;
};

export type GeoRollupItem = {
  state?: string;
  lga?: string;
  ward?: string;
  total_pus: number;
  pus_reported: number;
  registered_voters: number;
  accredited_voters: number;
};

export type Projection = {
  ourVotes: number;
  allVotes: number;
  currentVoteSharePercent: number;
  pusReported: number;
  totalPus: number;
  coveragePercent: number;
  projectedFinalVotes: number;
  votesNeededToWin: number;
  confidenceLevel: string;
};

export type NextPollingUnitResponse = {
  assignment: {
    assignmentId: string;
    pollingUnitId: string;
    puCode: string;
    puName: string;
    ward: string;
    lga: string;
    state: string;
    fieldAgentName: string | null;
    fieldAgentPhone: string | null;
    lastCalledAt: string | null;
    checkInIntervalMinutes: number;
  } | null;
};

export type MyElectionAssignment = {
  id: string;
  status: string;
  checkInIntervalMinutes: number;
  lastCalledAt: string | null;
  createdAt: string;
  puCode: string;
  puName: string;
  ward: string;
  lga: string;
  state: string;
  fieldAgentName: string | null;
  fieldAgentPhone: string | null;
};

export type MyElectionAssignmentsResponse = {
  data: MyElectionAssignment[];
};

export type ElectionDialResponse = {
  dialing: boolean;
  phoneNumber: string;
  modemId: string;
};

export type PollingUnitResultInput = {
  partyCandidateId: string;
  voteCount: number;
};

export type IncidentInput = {
  category: string;
  severity: string;
  description?: string;
};
