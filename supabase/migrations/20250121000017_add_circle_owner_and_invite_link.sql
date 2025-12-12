-- Add circle_owner and invite_link columns to circles table
-- invite_link will be auto-generated as: {baseUrl}/invite-landing?token={invite_token}

ALTER TABLE circles
ADD COLUMN IF NOT EXISTS circle_owner TEXT,
ADD COLUMN IF NOT EXISTS invite_link TEXT;

-- Function to generate invite_link
-- Uses production URL by default. For local dev, update manually or use application code
CREATE OR REPLACE FUNCTION generate_invite_link(invite_token_param TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Production URL: https://rose-bud-thorn.vercel.app/invite-landing?token={token}
  -- For local dev, you may need to update this manually or use application code
  RETURN 'https://rose-bud-thorn.vercel.app/invite-landing?token=' || invite_token_param;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to auto-generate invite_link when invite_token is set/updated
-- Note: The full URL with base domain will be set in application code
CREATE OR REPLACE FUNCTION set_invite_link()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if invite_token exists and invite_link is not already set
  IF NEW.invite_token IS NOT NULL AND (NEW.invite_link IS NULL OR NEW.invite_link = '') THEN
    NEW.invite_link := generate_invite_link(NEW.invite_token);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_invite_link ON circles;
CREATE TRIGGER trigger_set_invite_link
  BEFORE INSERT OR UPDATE ON circles
  FOR EACH ROW
  EXECUTE FUNCTION set_invite_link();

-- Update existing circles to have invite_link if they have invite_token
UPDATE circles
SET invite_link = generate_invite_link(invite_token)
WHERE invite_token IS NOT NULL AND (invite_link IS NULL OR invite_link = '');
