-- Add INSERT policy for profiles table
-- Users need to be able to create their own profile after OTP verification

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

