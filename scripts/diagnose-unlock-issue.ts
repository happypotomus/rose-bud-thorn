// Diagnostic script to debug unlock check issues
// Run with: npx tsx scripts/diagnose-unlock-issue.ts <circleId> <weekId>
// Or without args to check all circles for current week

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { isCircleUnlocked } from '../lib/supabase/unlock'

// Load environment variables from .env.local (or .env as fallback)
const envPath = resolve(process.cwd(), '.env.local')
config({ path: envPath, override: false })
// Also try .env if .env.local doesn't exist
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function diagnoseUnlock(circleId?: string, weekId?: string) {
  console.log('🔍 Unlock Diagnostic Tool\n')
  console.log('='.repeat(60))

  // Get current week if not provided
  let targetWeekId = weekId
  let targetWeek
  
  if (!targetWeekId) {
    const { data: currentWeek, error: weekError } = await supabase
      .rpc('get_or_create_current_week')
      .single()
    
    if (weekError) {
      console.error('❌ Error getting current week:', weekError)
      process.exit(1)
    }
    
    if (!currentWeek) {
      console.error('❌ Could not get current week (no data returned)')
      process.exit(1)
    }
    
    targetWeekId = currentWeek.id
    targetWeek = currentWeek
  } else {
    const { data: week, error: weekError } = await supabase
      .from('weeks')
      .select('*')
      .eq('id', targetWeekId)
      .single()
    
    if (weekError) {
      console.error(`❌ Error fetching week ${targetWeekId}:`, weekError)
      process.exit(1)
    }
    
    if (!week) {
      console.error(`❌ Week ${targetWeekId} not found`)
      process.exit(1)
    }
    
    targetWeek = week
  }

  console.log(`📅 Week ID: ${targetWeekId}`)
  console.log(`   Start: ${new Date(targetWeek.start_at).toISOString()}`)
  console.log(`   End: ${new Date(targetWeek.end_at).toISOString()}\n`)

  // Get all circles or specific circle
  let circles
  if (circleId) {
    const { data: circle } = await supabase
      .from('circles')
      .select('*')
      .eq('id', circleId)
      .single()
    
    if (!circle) {
      console.error(`❌ Circle ${circleId} not found`)
      process.exit(1)
    }
    
    circles = [circle]
  } else {
    const { data: allCircles } = await supabase
      .from('circles')
      .select('*')
      .order('created_at', { ascending: false })
    
    circles = allCircles || []
  }

  for (const circle of circles) {
    console.log('\n' + '='.repeat(60))
    console.log(`🔵 Circle: ${circle.name} (${circle.id})`)
    console.log('='.repeat(60))

    // Get all members
    const { data: members, error: membersError } = await supabase
      .from('circle_members')
      .select('user_id, created_at')
      .eq('circle_id', circle.id)
      .order('created_at', { ascending: true })

    if (membersError) {
      console.error(`❌ Error fetching members:`, membersError)
      continue
    }

    if (!members || members.length === 0) {
      console.log('⚠️  No members found')
      continue
    }

    console.log(`\n👥 Members (${members.length}):`)
    const weekStart = new Date(targetWeek.start_at)
    
    // Get member profiles
    const memberIds = members.map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name')
      .in('id', memberIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p.first_name]) || [])

    const preWeekMembers: typeof members = []
    const midWeekMembers: typeof members = []

    for (const member of members) {
      const memberJoinDate = new Date(member.created_at)
      const isPreWeek = memberJoinDate <= weekStart
      const name = profileMap.get(member.user_id) || member.user_id
      
      if (isPreWeek) {
        preWeekMembers.push(member)
        console.log(`  ✅ ${name} - Joined: ${memberJoinDate.toISOString()} (PRE-WEEK)`)
      } else {
        midWeekMembers.push(member)
        console.log(`  ⏰ ${name} - Joined: ${memberJoinDate.toISOString()} (MID-WEEK - excluded)`)
      }
    }

    // Get all submitted reflections
    const { data: reflections, error: reflectionsError } = await supabase
      .from('reflections')
      .select('user_id, submitted_at')
      .eq('circle_id', circle.id)
      .eq('week_id', targetWeekId)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: true })

    if (reflectionsError) {
      console.error(`❌ Error fetching reflections:`, reflectionsError)
      continue
    }

    console.log(`\n📝 Submitted Reflections (${reflections?.length || 0}):`)
    const submittedUserIds = new Set(reflections?.map(r => r.user_id) || [])
    
    if (reflections && reflections.length > 0) {
      for (const reflection of reflections) {
        const name = profileMap.get(reflection.user_id) || reflection.user_id
        console.log(`  ✅ ${name} - Submitted: ${new Date(reflection.submitted_at).toISOString()}`)
      }
    } else {
      console.log('  ⚠️  No reflections submitted yet')
    }

    // Check unlock status
    console.log(`\n🔓 Unlock Check:`)
    console.log(`   Pre-week members: ${preWeekMembers.length}`)
    console.log(`   Mid-week members: ${midWeekMembers.length} (excluded)`)
    console.log(`   Submitted reflections: ${reflections?.length || 0}`)

    const preWeekMemberIds = preWeekMembers.map(m => m.user_id)
    const missingSubmissions: string[] = []

    for (const memberId of preWeekMemberIds) {
      if (!submittedUserIds.has(memberId)) {
        const name = profileMap.get(memberId) || memberId
        missingSubmissions.push(name)
        console.log(`   ❌ ${name} - Missing submission`)
      } else {
        const name = profileMap.get(memberId) || memberId
        console.log(`   ✅ ${name} - Has submission`)
      }
    }

    // Use the actual unlock function
    const unlocked = await isCircleUnlocked(circle.id, targetWeekId, supabase)
    
    console.log(`\n🎯 Result: ${unlocked ? '✅ UNLOCKED' : '❌ LOCKED'}`)
    
    if (!unlocked && missingSubmissions.length > 0) {
      console.log(`   Waiting for: ${missingSubmissions.join(', ')}`)
    }

    if (preWeekMembers.length === 0) {
      console.log(`   ⚠️  No pre-week members - circle considered unlocked by default`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Diagnostic complete')
}

// Get args from command line
const args = process.argv.slice(2)
const circleId = args[0]
const weekId = args[1]

diagnoseUnlock(circleId, weekId).catch(console.error)
