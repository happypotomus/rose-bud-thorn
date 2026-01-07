-- Find all people who have completed a reflection AND have an unlocked circle this week
-- AND the circle has more than 1 person

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
    r.user_id,
    r.submitted_at
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
),
circle_member_counts AS (
  -- Count total members per circle
  SELECT 
    circle_id,
    COUNT(*) AS total_member_count
  FROM circle_members
  GROUP BY circle_id
)
SELECT 
  p.id AS user_id,
  p.first_name,
  p.phone,
  c.id AS circle_id,
  c.name AS circle_name,
  cus.pre_week_member_count,
  cus.submitted_member_count,
  cmc.total_member_count,
  sr.submitted_at AS reflection_submitted_at
FROM submitted_reflections sr
JOIN profiles p ON p.id = sr.user_id
JOIN circles c ON c.id = sr.circle_id
JOIN circle_unlock_status cus ON cus.circle_id = c.id
JOIN circle_member_counts cmc ON cmc.circle_id = c.id
WHERE cus.is_unlocked = true
  AND cmc.total_member_count > 1
ORDER BY c.name, p.first_name;

