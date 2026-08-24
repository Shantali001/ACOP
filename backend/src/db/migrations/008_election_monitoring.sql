BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPERVISOR';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS polling_units (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pu_code             TEXT NOT NULL UNIQUE,
    pu_name             TEXT NOT NULL,
    ward                TEXT NOT NULL,
    lga                 TEXT NOT NULL,
    state               TEXT NOT NULL,
    registered_voters   INTEGER NOT NULL DEFAULT 0,
    field_agent_name    TEXT,
    field_agent_phone   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polling_units_geo ON polling_units (state, lga, ward);

CREATE TABLE IF NOT EXISTS parties_candidates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    party_code  TEXT,
    is_our_party BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS election_monitoring_assignments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polling_unit_id             UUID NOT NULL REFERENCES polling_units(id),
    agent_id                    UUID NOT NULL REFERENCES users(id),
    status                      TEXT NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'closed')),
    check_in_interval_minutes   INTEGER NOT NULL DEFAULT 45,
    last_called_at              TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (polling_unit_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_ema_agent_status ON election_monitoring_assignments (agent_id, status);

CREATE TABLE IF NOT EXISTS polling_unit_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polling_unit_id     UUID NOT NULL REFERENCES polling_units(id),
    agent_id            UUID NOT NULL REFERENCES users(id),
    report_type         TEXT NOT NULL DEFAULT 'checkin'
                            CHECK (report_type IN ('opening', 'checkin', 'final')),
    accredited_voters   INTEGER,
    notes               TEXT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pu_reports_pu ON polling_unit_reports (polling_unit_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS polling_unit_results (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id               UUID NOT NULL REFERENCES polling_unit_reports(id) ON DELETE CASCADE,
    party_candidate_id      UUID NOT NULL REFERENCES parties_candidates(id),
    vote_count              INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS polling_unit_incidents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    polling_unit_id     UUID NOT NULL REFERENCES polling_units(id),
    report_id           UUID REFERENCES polling_unit_reports(id),
    category            TEXT NOT NULL,
    severity            TEXT NOT NULL DEFAULT 'medium'
                            CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description         TEXT,
    agent_id            UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pu_incidents_severity ON polling_unit_incidents (severity, created_at DESC);

CREATE TABLE IF NOT EXISTS election_targets (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_level                 TEXT NOT NULL DEFAULT 'overall'
                                    CHECK (scope_level IN ('overall', 'lga', 'ward')),
    scope_value                 TEXT,
    votes_needed_to_win         INTEGER NOT NULL,
    expected_turnout_percent    NUMERIC(5,2) NOT NULL DEFAULT 50.00,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION get_next_polling_unit_to_call(p_agent_id UUID)
RETURNS TABLE (
    assignment_id UUID,
    polling_unit_id UUID,
    pu_code TEXT,
    pu_name TEXT,
    ward TEXT,
    lga TEXT,
    state TEXT,
    field_agent_name TEXT,
    field_agent_phone TEXT,
    last_called_at TIMESTAMPTZ,
    check_in_interval_minutes INTEGER
) AS $$
    SELECT ema.id, pu.id, pu.pu_code, pu.pu_name, pu.ward, pu.lga, pu.state,
           pu.field_agent_name, pu.field_agent_phone,
           ema.last_called_at, ema.check_in_interval_minutes
    FROM election_monitoring_assignments ema
    JOIN polling_units pu ON pu.id = ema.polling_unit_id
    WHERE ema.agent_id = p_agent_id
      AND ema.status = 'active'
      AND (
        ema.last_called_at IS NULL
        OR ema.last_called_at + (ema.check_in_interval_minutes || ' minutes')::interval <= NOW()
      )
    ORDER BY ema.last_called_at ASC NULLS FIRST
    LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE VIEW polling_unit_latest_report AS
SELECT DISTINCT ON (polling_unit_id) *
FROM polling_unit_reports
ORDER BY polling_unit_id, submitted_at DESC;

CREATE OR REPLACE VIEW election_geo_rollup AS
SELECT
    pu.state, pu.lga, pu.ward,
    COUNT(*) AS total_pus,
    COUNT(lr.id) AS pus_reported,
    SUM(pu.registered_voters) AS registered_voters,
    SUM(COALESCE(lr.accredited_voters, 0)) AS accredited_voters
FROM polling_units pu
LEFT JOIN polling_unit_latest_report lr ON lr.polling_unit_id = pu.id
GROUP BY pu.state, pu.lga, pu.ward;

CREATE OR REPLACE VIEW election_results_rollup AS
SELECT pc.id AS party_candidate_id, pc.name, pc.party_code, pc.is_our_party,
       SUM(pr.vote_count) AS total_votes
FROM polling_unit_results pr
JOIN polling_unit_latest_report lr ON lr.id = pr.report_id
JOIN parties_candidates pc ON pc.id = pr.party_candidate_id
GROUP BY pc.id, pc.name, pc.party_code, pc.is_our_party;

CREATE OR REPLACE VIEW election_stale_pus AS
SELECT pu.id, pu.pu_code, pu.pu_name, pu.ward, pu.lga, pu.state,
       ema.last_called_at, ema.check_in_interval_minutes,
       (ema.last_called_at + (ema.check_in_interval_minutes || ' minutes')::interval) AS due_at
FROM election_monitoring_assignments ema
JOIN polling_units pu ON pu.id = ema.polling_unit_id
WHERE ema.status = 'active'
  AND ema.last_called_at + (ema.check_in_interval_minutes || ' minutes')::interval < NOW() - INTERVAL '15 minutes';

CREATE OR REPLACE VIEW election_projection AS
WITH totals AS (
    SELECT
        SUM(pr.vote_count) FILTER (WHERE pc.is_our_party) AS our_votes,
        SUM(pr.vote_count) AS all_votes,
        COUNT(DISTINCT lr.polling_unit_id) AS pus_reported,
        (SELECT COUNT(*) FROM polling_units) AS total_pus,
        (SELECT SUM(registered_voters) FROM polling_units) AS total_registered
    FROM polling_unit_results pr
    JOIN polling_unit_latest_report lr ON lr.id = pr.report_id
    JOIN parties_candidates pc ON pc.id = pr.party_candidate_id
),
target AS (
    SELECT expected_turnout_percent, votes_needed_to_win
    FROM election_targets
    WHERE scope_level = 'overall'
    ORDER BY updated_at DESC LIMIT 1
)
SELECT
    t.our_votes,
    t.all_votes,
    ROUND(100.0 * t.our_votes / NULLIF(t.all_votes, 0), 1) AS current_vote_share_percent,
    t.pus_reported,
    t.total_pus,
    ROUND(100.0 * t.pus_reported / NULLIF(t.total_pus, 0), 1) AS coverage_percent,
    ROUND(
        (t.our_votes::NUMERIC / NULLIF(t.all_votes, 0))
        * (t.total_registered * tgt.expected_turnout_percent / 100.0)
    ) AS projected_final_votes,
    tgt.votes_needed_to_win,
    CASE
        WHEN 100.0 * t.pus_reported / NULLIF(t.total_pus, 0) < 20 THEN 'Low'
        WHEN 100.0 * t.pus_reported / NULLIF(t.total_pus, 0) < 60 THEN 'Medium'
        ELSE 'High'
    END AS confidence_level
FROM totals t, target tgt;

COMMIT;
