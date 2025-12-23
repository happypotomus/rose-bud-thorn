-- Enable pg_cron extension in Supabase
-- Run this FIRST before checking or setting up cron jobs
-- 
-- Note: On some Supabase plans, you may need to:
-- 1. Go to Dashboard → Database → Extensions
-- 2. Find "pg_cron" in the list
-- 3. Click "Enable" button
-- 
-- Or run this SQL:

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Also enable pg_net (needed for HTTP calls to Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Verify extensions are enabled
SELECT 
  extname,
  extversion,
  CASE 
    WHEN extname IN ('pg_cron', 'pg_net') THEN '✅ Enabled'
    ELSE '❌ Not enabled'
  END as status
FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net')
ORDER BY extname;

-- If you get a permission error, you may need to:
-- 1. Check your Supabase plan (pg_cron may require Pro plan or higher)
-- 2. Enable it via Dashboard → Database → Extensions instead of SQL





