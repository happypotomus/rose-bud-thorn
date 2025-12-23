-- Check notification logs to see who received reminders
-- This shows which users were logged as receiving SMS

SELECT 
  nl.user_id,
  p.first_name,
  p.phone,
  nl.type,
  nl.sent_at,
  nl.message,
  nl.circle_id,
  nl.week_id
FROM notification_logs nl
LEFT JOIN profiles p ON nl.user_id = p.id
WHERE nl.type IN ('first_reminder', 'second_reminder')
ORDER BY nl.sent_at DESC
LIMIT 50;

-- ============================================================
-- Summary: Count reminders by type
-- ============================================================
SELECT 
  type,
  COUNT(*) as count,
  MIN(sent_at) as first_sent,
  MAX(sent_at) as last_sent
FROM notification_logs
WHERE type IN ('first_reminder', 'second_reminder')
GROUP BY type
ORDER BY type;

-- ============================================================
-- Check recent reminders (last 7 days)
-- ============================================================
SELECT 
  nl.sent_at,
  nl.type,
  p.first_name,
  p.phone,
  CASE 
    WHEN p.phone LIKE '+1%' AND LENGTH(p.phone) = 12 THEN '✅ US format'
    WHEN p.phone LIKE '+%' THEN '⚠️ Other country'
    ELSE '❌ Wrong format'
  END as phone_format
FROM notification_logs nl
LEFT JOIN profiles p ON nl.user_id = p.id
WHERE nl.type IN ('first_reminder', 'second_reminder')
  AND nl.sent_at > NOW() - INTERVAL '7 days'
ORDER BY nl.sent_at DESC;

-- ============================================================
-- Compare: Who should have received vs who was logged
-- ============================================================
-- Get all circle members who should have received reminders
SELECT 
  cm.user_id,
  p.first_name,
  p.phone,
  'Should receive reminder' as status
FROM circle_members cm
JOIN profiles p ON cm.user_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM notification_logs nl
  WHERE nl.user_id = cm.user_id
    AND nl.type = 'first_reminder'
    AND nl.sent_at > NOW() - INTERVAL '7 days'
)
ORDER BY p.first_name;
