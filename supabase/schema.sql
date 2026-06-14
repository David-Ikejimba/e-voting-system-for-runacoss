  -- ============================================================
  -- RUN Voting System — Supabase SQL Setup
  -- Run this entire file in: Supabase Dashboard → SQL Editor → New query
  -- NOTE: "position" is a reserved word in PostgreSQL, so we use
  --       "candidate_position" as the column name throughout.
  -- ============================================================

  -- ── 1. Tables ────────────────────────────────────────────────

  CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    matric_no   TEXT UNIQUE NOT NULL,
    department        TEXT NOT NULL CHECK (department IN ('CMP', 'CYB', 'IFT')),
    role              TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    active_session_id UUID,
    created_at        TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS elections (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                TEXT NOT NULL,
    eligible_departments TEXT[] NOT NULL,
    status               TEXT NOT NULL DEFAULT 'upcoming'
                          CHECK (status IN ('upcoming', 'active', 'paused', 'concluded')),
    start_time           TIMESTAMPTZ,
    end_time             TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id        UUID REFERENCES elections(id) ON DELETE CASCADE,
    candidate_position TEXT NOT NULL,
    name               TEXT NOT NULL,
    manifesto          TEXT,
    photo_url          TEXT,
    created_at         TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS user_votes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id),
    election_id UUID REFERENCES elections(id),
    voted_at    TIMESTAMPTZ DEFAULT now(),
    receipt     TEXT NOT NULL,
    UNIQUE(user_id, election_id)
  );

  CREATE TABLE IF NOT EXISTS votes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id        UUID REFERENCES elections(id),
    candidate_id       UUID REFERENCES candidates(id),
    candidate_position TEXT NOT NULL,
    voted_at           TIMESTAMPTZ DEFAULT date_trunc('hour', now())
  );

  CREATE TABLE IF NOT EXISTS turnout_metrics (
    election_id UUID REFERENCES elections(id),
    department  TEXT NOT NULL CHECK (department IN ('CMP', 'CYB', 'IFT')),
    vote_count  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (election_id, department)
  );

  CREATE TABLE IF NOT EXISTS admin_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id      UUID REFERENCES auth.users(id),
    action_type   TEXT NOT NULL,
    target_table  TEXT NOT NULL,
    target_id     TEXT,
    description   TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
  );

  -- ── 2. Enable Row Level Security ─────────────────────────────

  ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
  ALTER TABLE elections       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE candidates      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE user_votes      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE votes           ENABLE ROW LEVEL SECURITY;
  ALTER TABLE turnout_metrics ENABLE ROW LEVEL SECURITY;
  ALTER TABLE admin_logs      ENABLE ROW LEVEL SECURITY;

  -- ── 3. RLS Policies ──────────────────────────────────────────

  -- Create a helper function to avoid infinite recursion in RLS
  CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    );
  $$;

  -- profiles
  CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT USING (auth.uid() = id);

  CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

  CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

  CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT USING (is_admin());

  -- admin_logs
  CREATE POLICY "Admins can view admin_logs"
    ON admin_logs FOR SELECT USING (is_admin());

  -- elections (public read, admin write)
  CREATE POLICY "Anyone authenticated can read elections"
    ON elections FOR SELECT TO authenticated USING (true);

  CREATE POLICY "Admins can insert elections"
    ON elections FOR INSERT WITH CHECK (is_admin());

  CREATE POLICY "Admins can update elections"
    ON elections FOR UPDATE USING (is_admin());

  CREATE POLICY "Admins can delete elections"
    ON elections FOR DELETE USING (is_admin());

  -- candidates (public read, admin write)
  CREATE POLICY "Anyone authenticated can read candidates"
    ON candidates FOR SELECT TO authenticated USING (true);

  CREATE POLICY "Admins can insert candidates"
    ON candidates FOR INSERT WITH CHECK (is_admin());

  CREATE POLICY "Admins can update candidates"
    ON candidates FOR UPDATE USING (is_admin());

  CREATE POLICY "Admins can delete candidates"
    ON candidates FOR DELETE USING (is_admin());

  -- user_votes (users see own rows only; no direct insert — goes through cast_vote)
  CREATE POLICY "Users can view own votes"
    ON user_votes FOR SELECT USING (auth.uid() = user_id);

  CREATE POLICY "Admins can view all user_votes"
    ON user_votes FOR SELECT USING (is_admin());

  -- votes table: NO client policies — accessible ONLY via security definer functions

  -- turnout_metrics (public read for live display)
  CREATE POLICY "Anyone authenticated can read turnout"
    ON turnout_metrics FOR SELECT TO authenticated USING (true);

  -- ── DB Trigger: Audit Logging ─────────────────────────────────

  CREATE OR REPLACE FUNCTION public.log_admin_action()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    -- Only log if the user is an admin
    IF is_admin() THEN
      INSERT INTO admin_logs (admin_id, action_type, target_table, target_id, description)
      VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id::text, OLD.id::text),
        'Admin performed ' || TG_OP || ' on ' || TG_TABLE_NAME || ' record ' || COALESCE(NEW.id::text, OLD.id::text)
      );
    END IF;

    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END;
  $$;

  DROP TRIGGER IF EXISTS audit_elections_changes ON elections;
  CREATE TRIGGER audit_elections_changes
    AFTER INSERT OR UPDATE OR DELETE ON elections
    FOR EACH ROW EXECUTE FUNCTION log_admin_action();

  DROP TRIGGER IF EXISTS audit_candidates_changes ON candidates;
  CREATE TRIGGER audit_candidates_changes
    AFTER INSERT OR UPDATE OR DELETE ON candidates
    FOR EACH ROW EXECUTE FUNCTION log_admin_action();

  -- ── 4. DB Trigger: create profile on signup ───────────────────

  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    -- Only insert if metadata has matric_no (email/password signup)
    -- Google sign-ups will insert via the complete-profile page
    IF NEW.raw_user_meta_data->>'matric_no' IS NOT NULL THEN
      INSERT INTO profiles (id, full_name, matric_no, department, role)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'matric_no',
        NEW.raw_user_meta_data->>'department',
        'student'
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

  -- ── 5. cast_vote function ─────────────────────────────────────

  CREATE OR REPLACE FUNCTION cast_vote(
    p_election_id UUID,
    p_selections  JSONB   -- [{"candidate_position": "President", "candidate_id": "uuid"}, ...]
  ) RETURNS TEXT          -- receipt code
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  DECLARE
    v_receipt TEXT;
  BEGIN
    -- Guard: election must be active
    IF NOT EXISTS (
      SELECT 1 FROM elections WHERE id = p_election_id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'ELECTION_NOT_ACTIVE: This election is not currently open for voting.';
    END IF;

    -- Guard: user hasn't already voted
    IF EXISTS (
      SELECT 1 FROM user_votes WHERE user_id = auth.uid() AND election_id = p_election_id
    ) THEN
      RAISE EXCEPTION 'ALREADY_VOTED: You have already cast your vote in this election.';
    END IF;

    -- Insert anonymous ballots
    INSERT INTO votes (election_id, candidate_id, candidate_position)
    SELECT
      p_election_id,
      (sel->>'candidate_id')::UUID,
      sel->>'candidate_position'
    FROM jsonb_array_elements(p_selections) AS sel;

    -- Generate receipt and record has-voted
    v_receipt := substring(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    INSERT INTO user_votes (user_id, election_id, receipt)
    VALUES (auth.uid(), p_election_id, v_receipt);

    -- Increment turnout counter for user's department
    INSERT INTO turnout_metrics (election_id, department, vote_count)
    SELECT p_election_id, p.department, 1
    FROM profiles p
    WHERE p.id = auth.uid()
    ON CONFLICT (election_id, department)
    DO UPDATE SET vote_count = turnout_metrics.vote_count + 1;

    RETURN v_receipt;
  END;
  $$;

  -- ── 6. get_results function ───────────────────────────────────

  CREATE OR REPLACE FUNCTION get_results(p_election_id UUID)
  RETURNS TABLE (
    candidate_name     TEXT,
    candidate_position TEXT,
    vote_count         BIGINT
  )
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM elections WHERE id = p_election_id AND status = 'concluded'
    ) THEN
      RAISE EXCEPTION 'ELECTION_NOT_CONCLUDED: Results are only available after the election concludes.';
    END IF;

    RETURN QUERY
    SELECT
      c.name                AS candidate_name,
      v.candidate_position,
      COUNT(v.id)           AS vote_count
    FROM votes v
    JOIN candidates c ON c.id = v.candidate_id
    WHERE v.election_id = p_election_id
    GROUP BY c.name, v.candidate_position
    ORDER BY v.candidate_position, vote_count DESC;
  END;
  $$;

  -- ── 7. verify_receipt function ─────────────────────────────────

  CREATE OR REPLACE FUNCTION verify_receipt(p_receipt TEXT)
  RETURNS BOOLEAN
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
      SELECT 1 FROM user_votes WHERE receipt = p_receipt
    );
  $$;

  -- ── 8. get_turnout_time_series function ────────────────────────

  CREATE OR REPLACE FUNCTION get_turnout_time_series(p_election_id UUID)
  RETURNS TABLE (
    vote_hour TIMESTAMPTZ,
    vote_count BIGINT
  )
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT voted_at AS vote_hour, COUNT(id) AS vote_count
    FROM votes
    WHERE election_id = p_election_id
    GROUP BY voted_at
    ORDER BY voted_at ASC;
  $$;

  -- ── Done! ─────────────────────────────────────────────────────
  -- Test cast_vote in the SQL editor (replace UUIDs with real ones):
  --   SELECT cast_vote(
  --     '<election_id>',
  --     '[{"candidate_position":"President","candidate_id":"<cand_id>"}]'
  --   );
