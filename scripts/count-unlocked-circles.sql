-- Count how many circles are unlocked for the current week
-- A circle is unlocked when all members who joined before/at the week start
-- have submitted their reflections (submitted_at IS NOT NULL)
-- Members who joined mid-week are excluded from the unlock check

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

-- Summary: Count unlocked circles
SELECT 
  COUNT(*) FILTER (WHERE is_unlocked = true) AS unlocked_circles_count,
  COUNT(*) AS total_circles_count,
  COUNT(*) FILTER (WHERE is_unlocked = false) AS locked_circles_count
FROM circle_unlock_status_temp;

-- List of locked circles with details
SELECT 
  circle_id,
  circle_name,
  pre_week_member_count,
  submitted_member_count,
  (pre_week_member_count - submitted_member_count) AS missing_submissions_count,
  CASE 
    WHEN pre_week_member_count = 0 THEN 'Unlocked (no pre-week members)'
    WHEN pre_week_member_count = submitted_member_count THEN 'Unlocked (all submitted)'
    ELSE 'Locked'
  END AS status
FROM circle_unlock_status_temp
WHERE is_unlocked = false
ORDER BY circle_name;

-- List of people who haven't completed their reflections
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
missing_submissions AS (
  -- Find pre-week members who haven't submitted
  SELECT 
    pwm.circle_id,
    pwm.user_id
  FROM pre_week_members pwm
  LEFT JOIN submitted_reflections sr 
    ON sr.circle_id = pwm.circle_id 
    AND sr.user_id = pwm.user_id
  WHERE sr.user_id IS NULL
)
SELECT 
  c.name AS circle_name,
  p.first_name,
  p.phone,
  ms.user_id
FROM missing_submissions ms
JOIN circles c ON c.id = ms.circle_id
JOIN profiles p ON p.id = ms.user_id
ORDER BY c.name, p.first_name;

