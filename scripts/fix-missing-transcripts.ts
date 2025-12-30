// Script to retroactively fix missing transcripts
// Copies transcripts from one reflection instance to all other instances for the same user/week
// Run with: npx tsx scripts/fix-missing-transcripts.ts

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixMissingTranscripts() {
  console.log('🔍 Finding reflections with missing transcripts...\n')

  // Find all reflections that have at least one transcript but others in the same user/week don't
  // Strategy: Group by user_id + week_id, find groups where some have transcripts and others don't
  
  // Get all reflections with transcripts
  // Use a simpler approach: get all submitted reflections, then filter in code
  const { data: allReflections, error: queryError } = await supabase
    .from('reflections')
    .select('user_id, week_id, circle_id, rose_transcript, bud_transcript, thorn_transcript')
    .not('submitted_at', 'is', null)

  if (queryError) {
    console.error('Error querying reflections:', queryError)
    return
  }

  if (!allReflections || allReflections.length === 0) {
    console.log('No reflections found')
    return
  }

  console.log(`Found ${allReflections.length} total reflection(s)\n`)

  // Filter to only reflections that have at least one transcript
  const reflectionsWithTranscripts = allReflections.filter(r => 
    r.rose_transcript || r.bud_transcript || r.thorn_transcript
  )

  if (reflectionsWithTranscripts.length === 0) {
    console.log('No reflections with transcripts found')
    return
  }

  if (!reflectionsWithTranscripts || reflectionsWithTranscripts.length === 0) {
    console.log('No reflections with transcripts found')
    return
  }

  console.log(`Found ${reflectionsWithTranscripts.length} reflection(s) with transcripts\n`)

  // Group by user_id + week_id
  const groups = new Map<string, typeof reflectionsWithTranscripts>()
  
  for (const reflection of reflectionsWithTranscripts) {
    const key = `${reflection.user_id}|${reflection.week_id}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(reflection)
  }

  console.log(`Found ${groups.size} unique user/week combinations\n`)

  let fixedCount = 0

  for (const [key, reflections] of groups) {
    // Find the reflection with the most complete transcripts
    const withTranscripts = reflections.filter(r => 
      r.rose_transcript || r.bud_transcript || r.thorn_transcript
    )

    if (withTranscripts.length === 0) continue

    // Get the first one with transcripts (they should all be the same)
    const sourceReflection = withTranscripts[0]

    // Get ALL reflections for this user/week (including ones without transcripts)
    const [userId, weekId] = key.split('|')
    const { data: allReflections } = await supabase
      .from('reflections')
      .select('id, circle_id, rose_transcript, bud_transcript, thorn_transcript')
      .eq('user_id', userId)
      .eq('week_id', weekId)
      .not('submitted_at', 'is', null)

    if (!allReflections) continue

    // Find reflections that need updating (missing transcripts)
    const needsUpdate = allReflections.filter(r => {
      const needsRose = sourceReflection.rose_transcript && !r.rose_transcript
      const needsBud = sourceReflection.bud_transcript && !r.bud_transcript
      const needsThorn = sourceReflection.thorn_transcript && !r.thorn_transcript
      return needsRose || needsBud || needsThorn
    })

    if (needsUpdate.length === 0) continue

    console.log(`\n📝 User ${userId.substring(0, 8)}... Week ${weekId.substring(0, 8)}...`)
    console.log(`   Source circle: ${sourceReflection.circle_id.substring(0, 8)}...`)
    console.log(`   Reflections needing update: ${needsUpdate.length}`)

    // Update each reflection that's missing transcripts
    for (const reflection of needsUpdate) {
      const updates: {
        rose_transcript?: string | null
        bud_transcript?: string | null
        thorn_transcript?: string | null
      } = {}

      if (sourceReflection.rose_transcript && !reflection.rose_transcript) {
        updates.rose_transcript = sourceReflection.rose_transcript
      }
      if (sourceReflection.bud_transcript && !reflection.bud_transcript) {
        updates.bud_transcript = sourceReflection.bud_transcript
      }
      if (sourceReflection.thorn_transcript && !reflection.thorn_transcript) {
        updates.thorn_transcript = sourceReflection.thorn_transcript
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('reflections')
          .update(updates)
          .eq('id', reflection.id)

        if (error) {
          console.error(`   ❌ Error updating ${reflection.id}:`, error.message)
        } else {
          console.log(`   ✅ Updated ${reflection.circle_id.substring(0, 8)}... with ${Object.keys(updates).length} transcript(s)`)
          fixedCount++
        }
      }
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} reflection(s) with missing transcripts`)
}

fixMissingTranscripts().catch(console.error)
