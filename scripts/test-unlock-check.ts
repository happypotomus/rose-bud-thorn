// Test the isCircleUnlocked function directly
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const CIRCLE_ID = '21e9a0b6-8bd3-401b-84d7-5a5976721e9e'
const WEEK_ID = '9d065fa1-0b5c-4981-a80b-0dff35f07bf4'

async function testUnlock() {
  // Test with service role (like unlock-sms.ts does)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get all circle members
  const { data: members } = await supabase
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', CIRCLE_ID)

  console.log(`Members: ${members?.length}`)

  // Get all submitted reflections
  const { data: reflections } = await supabase
    .from('reflections')
    .select('user_id')
    .eq('circle_id', CIRCLE_ID)
    .eq('week_id', WEEK_ID)
    .not('submitted_at', 'is', null)

  console.log(`Submitted reflections: ${reflections?.length}`)

  // Check if unlocked
  const memberIds = new Set(members?.map(m => m.user_id) || [])
  const submittedUserIds = new Set(reflections?.map(r => r.user_id) || [])

  let allSubmitted = true
  for (const memberId of memberIds) {
    if (!submittedUserIds.has(memberId)) {
      allSubmitted = false
      console.log(`Missing: ${memberId}`)
    }
  }

  console.log(`\n🔓 Unlocked: ${allSubmitted ? 'YES ✅' : 'NO ❌'}`)
  
  // Now test via the API
  console.log('\n📞 Testing via API...')
  const response = await fetch('http://localhost:3000/api/send-unlock-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circleId: CIRCLE_ID, weekId: WEEK_ID }),
  })
  
  const result = await response.json()
  console.log('API Response:', JSON.stringify(result, null, 2))
}

testUnlock().catch(console.error)


