-- Allow authenticated users to create circles
-- Allow users to view circles they own

-- Policy to allow authenticated users to INSERT circles
CREATE POLICY "Users can create circles" ON circles
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Policy to allow users to SELECT circles they own
CREATE POLICY "Users can view circles they own" ON circles
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.first_name = circles.circle_owner
    )
  );
