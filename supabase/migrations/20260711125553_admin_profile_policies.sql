/*
# SmartClass Zambia — Admin can read all profiles

## 1. Security (RLS)
- profiles: added a SELECT policy allowing admin users to read all profiles.
  Regular pupils can still only read their own profile (existing policy).
  This enables the admin dashboard user management tab.

## 2. Notes
- Idempotent (DROP POLICY IF EXISTS before CREATE).
- No destructive operations.
*/

DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admins can update any profile's role
DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE
  TO authenticated USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  ) WITH CHECK (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
