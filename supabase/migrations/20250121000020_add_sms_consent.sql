-- Add SMS consent tracking to profiles table
-- Required for A2P 10DLC compliance

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;

-- Add comment explaining the field
COMMENT ON COLUMN profiles.sms_consent_at IS 'Timestamp when user consented to receive SMS reminders. Required for A2P 10DLC compliance.';
