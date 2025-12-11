// Check if unlock SMS was already sent
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CIRCLE_ID = '21e9a0b6-8bd3-401b-84d7-5a5976721e9e'
const WEEK_ID = '9d065fa1-0b5c-4981-a80b-0dff35f07bf4'

async function checkLogs() {
  const { data: logs } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('circle_id', CIRCLE_ID)
    .eq('week_id', WEEK_ID)
    .eq('type', 'unlock')
    .order('sent_at', { ascending: false })

  console.log(`Found ${logs?.length || 0} unlock notification(s) for this week:\n`)
  
  if (logs && logs.length > 0) {
    for (const log of logs) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', log.user_id)
        .single()
      
      console.log(`  ${profile?.first_name || log.user_id}: ${log.sent_at}`)
    }
    console.log('\n⚠️  Unlock SMS was already sent! The function prevents duplicate sends.')
  } else {
    console.log('No unlock notifications found. SMS should be sent.')
  }
}

checkLogs().catch(console.error)

