-- Find all profiles associated with "nickanik"
-- Searches in: circle names, first names, phone numbers, and invite tokens

-- First, find matching circles
WITH matching_circles AS (
  SELECT 
    c.id AS circle_id,
    c.name AS circle_name,
    c.invite_token
  FROM circles c
  WHERE LOWER(c.name) LIKE '%nickanik%'
     OR LOWER(c.invite_token) LIKE '%nickanik%'
),
-- Find matching profiles directly
matching_profiles AS (
  SELECT 
    p.id AS profile_id,
    p.first_name,
    p.phone
  FROM profiles p
  WHERE LOWER(p.first_name) LIKE '%nickanik%'
     OR LOWER(p.phone) LIKE '%nickanik%'
),
-- Get all profiles in matching circles
profiles_in_matching_circles AS (
  SELECT DISTINCT
    cm.user_id,
    mc.circle_id,
    mc.circle_name,
    mc.invite_token
  FROM matching_circles mc
  JOIN circle_members cm ON cm.circle_id = mc.circle_id
)
-- Combine results: profiles that match directly OR are in matching circles
SELECT DISTINCT
  p.id AS user_id,
  p.first_name,
  p.phone,
  p.created_at AS profile_created_at,
  COALESCE(pimc.circle_id, cm.circle_id) AS circle_id,
  COALESCE(pimc.circle_name, c.name) AS circle_name,
  COALESCE(pimc.invite_token, c.invite_token) AS invite_token,
  CASE 
    WHEN mp.profile_id IS NOT NULL THEN 'Direct profile match (name or phone)'
    WHEN pimc.user_id IS NOT NULL THEN 'Member of matching circle'
    ELSE 'Unknown'
  END AS match_reason
FROM profiles p
LEFT JOIN matching_profiles mp ON mp.profile_id = p.id
LEFT JOIN profiles_in_matching_circles pimc ON pimc.user_id = p.id
LEFT JOIN circle_members cm ON cm.user_id = p.id
LEFT JOIN circles c ON c.id = COALESCE(pimc.circle_id, cm.circle_id)
WHERE mp.profile_id IS NOT NULL 
   OR pimc.user_id IS NOT NULL
ORDER BY circle_name, p.first_name;

