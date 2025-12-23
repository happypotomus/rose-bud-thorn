-- Add SMS opt-out tracking to profiles table
-- Required for A2P 10DLC compliance and STOP functionality

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS sms_opted_out_at TIMESTAMPTZ;

-- Add comment explaining the field
COMMENT ON COLUMN profiles.sms_opted_out_at IS 'Timestamp when user opted out of SMS reminders (e.g., replied STOP). When set, user should not receive SMS reminders.';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_profiles_sms_opted_out ON profiles(sms_opted_out_at) WHERE sms_opted_out_at IS NOT NULL;
