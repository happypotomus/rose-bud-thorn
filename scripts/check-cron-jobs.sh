#!/bin/bash
# Script to check Supabase cron jobs via CLI

echo "🔍 Checking Supabase cron jobs..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first."
    exit 1
fi

# Get project ref from env or config
PROJECT_REF=${SUPABASE_PROJECT_REF:-"wildgnkpmalxvadlmjbj"}

echo "📋 Checking for pg_cron extension..."
supabase db execute --project-ref "$PROJECT_REF" <<EOF
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
    THEN '✅ pg_cron extension is enabled'
    ELSE '❌ pg_cron extension is NOT enabled'
  END as extension_status;
EOF

echo ""
echo "📋 Listing all cron jobs:"
supabase db execute --project-ref "$PROJECT_REF" <<EOF
SELECT 
  jobid,
  schedule,
  CASE 
    WHEN LENGTH(command) > 100 THEN LEFT(command, 100) || '...'
    ELSE command
  END as command_preview,
  active,
  jobname
FROM cron.job
ORDER BY jobid;
EOF

echo ""
echo "📋 Checking for Sunday/Monday reminder jobs:"
supabase db execute --project-ref "$PROJECT_REF" <<EOF
SELECT 
  jobid,
  schedule,
  CASE 
    WHEN LENGTH(command) > 150 THEN LEFT(command, 150) || '...'
    ELSE command
  END as command_preview,
  active,
  jobname
FROM cron.job
WHERE command LIKE '%sunday-reminder%' 
   OR command LIKE '%monday-reminder%'
   OR jobname LIKE '%sunday%'
   OR jobname LIKE '%monday%'
   OR schedule LIKE '% * * 0%'  -- Sunday
   OR schedule LIKE '% * * 1%';  -- Monday
EOF

echo ""
echo "⚠️  Note: If no jobs are found, you need to create them in Supabase Dashboard:"
echo "   1. Go to: Database → Cron Jobs"
echo "   2. Create job for Sunday 7pm PST (Monday 3am UTC):"
echo "      - Schedule: 0 3 * * 1"
echo "      - Command: SELECT net.http_post(...)"
echo "   3. Create job for Monday 7pm PST (Tuesday 3am UTC):"
echo "      - Schedule: 0 3 * * 2"
echo "      - Command: SELECT net.http_post(...)"
echo ""
echo "📝 See CHUNK_10_TESTING.md for detailed setup instructions"





