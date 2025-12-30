-- Update all existing invite links to use the new custom domain (rosebuds.app)
-- This regenerates invite_link for all circles that have an invite_token

UPDATE circles
SET invite_link = 'https://rosebuds.app/invite-landing?token=' || invite_token
WHERE invite_token IS NOT NULL 
  AND invite_token != '';

-- Verify the update
SELECT 
  id,
  name,
  invite_token,
  invite_link
FROM circles
WHERE invite_token IS NOT NULL
ORDER BY created_at DESC;
