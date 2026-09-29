/*
# SmartClass Zambia — Fix: Admin Bootstrapping Was Silently Impossible

The role-protection trigger must allow trusted SQL Editor or service-role
contexts, where auth.uid() is NULL, to promote the first admin account.
Authenticated non-admin users remain blocked from changing their own role.
*/

CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
