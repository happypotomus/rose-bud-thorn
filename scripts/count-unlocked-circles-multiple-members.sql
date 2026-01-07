-- Count how many circles are unlocked (everyone submitted a reflection) 
-- AND the circle has more than 1 person

-- Create a temporary table to store unlock status (accessible across multiple queries)
CREATE TEMP TABLE IF NOT EXISTS circle_unlock_status_temp AS
WITH current_week AS (
  -- Get the current week
  SELECT * FROM get_or_create_current_week()
),
pre_week_members AS (
  -- Get all members who joined before or at the week start
  SELECT 
    cm.circle_id,
    cm.user_id,
    cm.created_at AS member_joined_at
  FROM circle_members cm
  CROSS JOIN current_week cw
  WHERE cm.created_at <= cw.start_at
),
submitted_reflections AS (
  -- Get all submitted reflections for the current week
  SELECT 
    r.circle_id,
    r.user_id
  FROM reflections r
  CROSS JOIN current_week cw
  WHERE r.week_id = cw.id
    AND r.submitted_at IS NOT NULL
),
circle_unlock_status AS (
  -- For each circle, check if all pre-week members have submitted
  SELECT 
    c.id AS circle_id,
    c.name AS circle_name,
    COUNT(DISTINCT pwm.user_id) AS pre_week_member_count,
    COUNT(DISTINCT sr.user_id) AS submitted_member_count,
    CASE 
      -- If no pre-week members, circle is considered unlocked
      WHEN COUNT(DISTINCT pwm.user_id) = 0 THEN true
      -- If all pre-week members have submitted, circle is unlocked
      WHEN COUNT(DISTINCT pwm.user_id) = COUNT(DISTINCT sr.user_id) THEN true
      ELSE false
    END AS is_unlocked
  FROM circles c
  LEFT JOIN pre_week_members pwm ON pwm.circle_id = c.id
  LEFT JOIN submitted_reflections sr 
    ON sr.circle_id = c.id 
    AND sr.user_id = pwm.user_id
  GROUP BY c.id, c.name
)
SELECT * FROM circle_unlock_status;

-- Create a temporary table for circle member counts
CREATE TEMP TABLE IF NOT EXISTS circle_member_counts_temp AS
SELECT 
  circle_id,
  COUNT(*) AS total_member_count
FROM circle_members
GROUP BY circle_id;

-- Count of unlocked circles with multiple members
SELECT 
  COUNT(*) AS unlocked_circles_with_multiple_members
FROM circle_unlock_status_temp cus
JOIN circle_member_counts_temp cmc ON cmc.circle_id = cus.circle_id
WHERE cus.is_unlocked = true
  AND cmc.total_member_count > 1;

-- Detailed list of unlocked circles with multiple members
SELECT 
  cus.circle_id,
  cus.circle_name,
  cus.pre_week_member_count,
  cus.submitted_member_count,
  cmc.total_member_count
FROM circle_unlock_status_temp cus
JOIN circle_member_counts_temp cmc ON cmc.circle_id = cus.circle_id
WHERE cus.is_unlocked = true
  AND cmc.total_member_count > 1
ORDER BY cus.circle_name;

