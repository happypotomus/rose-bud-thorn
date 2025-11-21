-- Allow users to view profiles of other users in the same circle
-- This is needed for the reading page to display friend names

CREATE POLICY "Users can view profiles in same circle" ON profiles
  FOR SELECT USING (
    -- Allow if viewing own profile
    auth.uid() = id
    OR
    -- Allow if the profile belongs to a user in the same circle
    EXISTS (
      SELECT 1 FROM circle_members cm1
      INNER JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
      WHERE cm1.user_id = auth.uid()
        AND cm2.user_id = profiles.id
    )
  );

