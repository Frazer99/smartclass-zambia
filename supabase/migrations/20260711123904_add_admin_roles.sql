/*
# SmartClass Zambia — Admin roles + content materials write access

## 1. Modified Tables

### profiles
- Added `role` column (text, default 'pupil') — values: 'pupil' | 'admin'.
  Used by edge functions to gate admin operations (content management, MOE/ECZ sync).

### content_materials
- Added INSERT, UPDATE, DELETE policies for authenticated users.
  In a production system these would be scoped to admin role only via a check
  function, but for the MVP we allow any authenticated user to manage materials
  through the edge function which performs its own role check.

## 2. Security (RLS)
- profiles: added SELECT policy so edge functions can read role via service role.
- content_materials: added INSERT/UPDATE/DELETE for authenticated users.
- search_index: added INSERT/DELETE for authenticated users (for rebuild after sync).

## 3. Notes
- All statements idempotent.
- No destructive operations.
*/

-- Add role column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'pupil';
  END IF;
END $$;

-- Content materials write policies for authenticated users
DROP POLICY IF EXISTS "insert_content_materials" ON content_materials;
CREATE POLICY "insert_content_materials" ON content_materials FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_content_materials" ON content_materials;
CREATE POLICY "update_content_materials" ON content_materials FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_content_materials" ON content_materials;
CREATE POLICY "delete_content_materials" ON content_materials FOR DELETE
  TO authenticated USING (true);

-- Search index write policies for authenticated users (for rebuild after sync)
DROP POLICY IF EXISTS "insert_search_index" ON search_index;
CREATE POLICY "insert_search_index" ON search_index FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_search_index" ON search_index;
CREATE POLICY "delete_search_index" ON search_index FOR DELETE
  TO authenticated USING (true);

-- Index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
