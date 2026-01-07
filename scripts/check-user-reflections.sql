-- Check how many reflections user_id fc9eade1-42b3-4ef5-b09c-54f2417bc6f7 has submitted and for what weeks

WITH target_user AS (
  SELECT 'fc9eade1-42b3-4ef5-b09c-54f2417bc6f7'::uuid AS user_id
)
-- Count total submitted reflections
SELECT 
  COUNT(*) AS total_submitted_reflections
FROM reflections r
CROSS JOIN target_user tu
WHERE r.user_id = tu.user_id
  AND r.submitted_at IS NOT NULL;

-- Detailed list of submitted reflections with week information
SELECT 
  r.user_id,
  p.first_name,
  p.phone,
  r.circle_id,
  c.name AS circle_name,
  r.week_id,
  w.start_at AS week_start,
  w.end_at AS week_end,
  r.submitted_at,
  CASE 
    WHEN r.rose_text IS NOT NULL OR r.rose_audio_url IS NOT NULL THEN true 
    ELSE false 
  END AS has_rose,
  CASE 
    WHEN r.bud_text IS NOT NULL OR r.bud_audio_url IS NOT NULL THEN true 
    ELSE false 
  END AS has_bud,
  CASE 
    WHEN r.thorn_text IS NOT NULL OR r.thorn_audio_url IS NOT NULL THEN true 
    ELSE false 
  END AS has_thorn
FROM reflections r
JOIN profiles p ON p.id = r.user_id
JOIN circles c ON c.id = r.circle_id
JOIN weeks w ON w.id = r.week_id
WHERE r.user_id = 'fc9eade1-42b3-4ef5-b09c-54f2417bc6f7'::uuid
  AND r.submitted_at IS NOT NULL
ORDER BY w.start_at DESC;

-- Also show any reflections that exist but haven't been submitted yet
SELECT 
  r.user_id,
  p.first_name,
  r.circle_id,
  c.name AS circle_name,
  r.week_id,
  w.start_at AS week_start,
  w.end_at AS week_end,
  r.submitted_at,
  'Not submitted' AS status
FROM reflections r
JOIN profiles p ON p.id = r.user_id
JOIN circles c ON c.id = r.circle_id
JOIN weeks w ON w.id = r.week_id
WHERE r.user_id = 'fc9eade1-42b3-4ef5-b09c-54f2417bc6f7'::uuid
  AND r.submitted_at IS NULL
ORDER BY w.start_at DESC;

