-- Saved sequences: a coach's personal library of reusable movement patterns.
--
-- A sequence is a slice of phases extracted from a system, stripped of identity
-- (names, photos, player IDs), and stored for reuse across any system.
--
-- The same architecture as studio_systems in 005: one row per sequence per
-- owner, the document in a jsonb column, RLS restricting everything to
-- own rows, and a trigger keeping the timestamp honest.
--
-- Private by design. There is no public listing, no sharing, no cross-account
-- access. A sequence is a coach's own vocabulary — "the third-man run", "my
-- rondo reset" — and it has no business on anybody else's screen.

CREATE TABLE IF NOT EXISTS studio_sequences (
  id         text        NOT NULL,
  owner      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc        jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, id)
);

ALTER TABLE studio_sequences ENABLE ROW LEVEL SECURITY;

-- Own rows only: same policy shape as studio_systems.
DROP POLICY IF EXISTS "own_rows" ON studio_sequences;
CREATE POLICY "own_rows" ON studio_sequences
  FOR ALL USING (auth.uid() = owner)
  WITH CHECK (auth.uid() = owner);

-- Auto-update timestamp, same trigger function as 005.
-- The function already exists from the systems table; this just applies it.
DROP TRIGGER IF EXISTS studio_sequences_touch ON studio_sequences;
CREATE TRIGGER studio_sequences_touch
  BEFORE UPDATE ON studio_sequences
  FOR EACH ROW EXECUTE FUNCTION public.studio_touch_updated_at();
