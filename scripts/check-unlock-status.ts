// Script to debug unlock status
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CIRCLE_ID = '21e9a0b6-8bd3-401b-84d7-5a5976721e9e'
const WEEK_ID = '9d065fa1-0b5c-4981-a80b-0dff35f07bf4'

async function checkStatus() {
  console.log('🔍 Checking unlock status...\n')

  // Get all circle members
  const { data: members } = await supabase
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', CIRCLE_ID)

  console.log(`Members: ${members?.length}`)
  const memberIds = members?.map(m => m.user_id) || []
  console.log(`Member IDs: ${memberIds.join(', ')}\n`)

  // Get submitted reflections
  const { data: reflections } = await supabase
    .from('reflections')
    .select('user_id, submitted_at')
    .eq('circle_id', CIRCLE_ID)
    .eq('week_id', WEEK_ID)
    .not('submitted_at', 'is', null)

  console.log(`Submitted reflections: ${reflections?.length}`)
  const submittedIds = reflections?.map(r => r.user_id) || []
  console.log(`Submitted user IDs: ${submittedIds.join(', ')}\n`)

  // Check each member
  console.log('Member submission status:')
  for (const memberId of memberIds) {
    const hasSubmitted = submittedIds.includes(memberId)
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', memberId)
      .single()
    
    console.log(`  ${profile?.first_name || memberId}: ${hasSubmitted ? '✅' : '❌'}`)
  }

  // Check if unlocked
  const allSubmitted = memberIds.every(id => submittedIds.includes(id))
  console.log(`\n🔓 Circle unlocked: ${allSubmitted ? 'YES ✅' : 'NO ❌'}`)
}

checkStatus().catch(console.error)


