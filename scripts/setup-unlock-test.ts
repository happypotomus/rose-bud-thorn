// Script to set up unlock SMS test scenario
// Inserts test reflections for all members who haven't submitted

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Default circle and week IDs from your test
const CIRCLE_ID = '21e9a0b6-8bd3-401b-84d7-5a5976721e9e'
const WEEK_ID = '9d065fa1-0b5c-4981-a80b-0dff35f07bf4'

async function setupUnlockTest() {
  console.log('🔍 Checking circle members and submission status...\n')

  // Get all circle members
  const { data: members, error: membersError } = await supabase
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', CIRCLE_ID)

  if (membersError || !members) {
    console.error('Error fetching members:', membersError)
    process.exit(1)
  }

  console.log(`Found ${members.length} member(s) in circle\n`)

  // Get profiles for members
  const userIds = members.map(m => m.user_id)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name')
    .in('id', userIds)

  if (profilesError || !profiles) {
    console.error('Error fetching profiles:', profilesError)
    process.exit(1)
  }

  // Get existing reflections
  const { data: reflections, error: reflectionsError } = await supabase
    .from('reflections')
    .select('user_id')
    .eq('circle_id', CIRCLE_ID)
    .eq('week_id', WEEK_ID)
    .not('submitted_at', 'is', null)

  if (reflectionsError) {
    console.error('Error fetching reflections:', reflectionsError)
    process.exit(1)
  }

  const submittedUserIds = new Set((reflections || []).map(r => r.user_id))
  const profileMap = new Map(profiles.map(p => [p.id, p.first_name]))

  console.log('📊 Current Status:')
  console.log('─'.repeat(50))
  for (const profile of profiles) {
    const hasSubmitted = submittedUserIds.has(profile.id)
    const status = hasSubmitted ? '✅ Submitted' : '❌ Not submitted'
    console.log(`${profile.first_name}: ${status}`)
  }
  console.log('─'.repeat(50))
  console.log()

  // Find members who haven't submitted
  const nonSubmitters = profiles.filter(p => !submittedUserIds.has(p.id))

  if (nonSubmitters.length === 0) {
    console.log('✅ All members have already submitted!')
    console.log('Circle should be unlocked. You can test unlock SMS now.\n')
    return
  }

  console.log(`📝 Found ${nonSubmitters.length} member(s) without submissions`)
  console.log('Inserting test reflections...\n')

  // Insert test reflections for non-submitters
  const insertPromises = nonSubmitters.map(profile => 
    supabase
      .from('reflections')
      .insert({
        circle_id: CIRCLE_ID,
        week_id: WEEK_ID,
        user_id: profile.id,
        rose_text: 'Test Rose - Auto-generated for unlock SMS test',
        bud_text: 'Test Bud - Auto-generated for unlock SMS test',
        thorn_text: 'Test Thorn - Auto-generated for unlock SMS test',
        submitted_at: new Date().toISOString(),
      })
  )

  const results = await Promise.all(insertPromises)
  const errors = results.filter(r => r.error)

  if (errors.length > 0) {
    console.error('❌ Some insertions failed:')
    errors.forEach((r, i) => {
      console.error(`  ${nonSubmitters[i].first_name}: ${r.error?.message}`)
    })
    process.exit(1)
  }

  console.log('✅ Successfully inserted test reflections for:')
  nonSubmitters.forEach(p => console.log(`   - ${p.first_name}`))
  console.log()
  console.log('🎉 Circle is now unlocked! You can test unlock SMS now.')
}

setupUnlockTest().catch(console.error)


