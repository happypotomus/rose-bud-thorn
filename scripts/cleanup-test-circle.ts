/**
 * Script to clean up test circle and all associated data
 * 
 * Usage:
 * 1. Make sure you have SUPABASE_SERVICE_ROLE_KEY in your environment
 * 2. Run: npx tsx scripts/cleanup-test-circle.ts [circle-id]
 * 
 * If no circle ID is provided, it will try to read from .test-circle-id file
 * 
 * This deletes:
 * - All reflections in the test circle
 * - All circle members
 * - The test circle itself
 * - All photos in storage for the test circle
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  console.error('\nPlease set these in your .env.local file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function cleanupTestCircle(circleId?: string) {
  let targetCircleId = circleId

  // If no circle ID provided, try to read from file
  if (!targetCircleId) {
    const testDataFile = join(process.cwd(), '.test-circle-id')
    if (existsSync(testDataFile)) {
      try {
        targetCircleId = readFileSync(testDataFile, 'utf-8').trim()
        console.log(`📖 Found circle ID in ${testDataFile}: ${targetCircleId}\n`)
      } catch (error) {
        console.error('❌ Could not read test circle ID file')
      }
    }
  }

  if (!targetCircleId) {
    console.error('❌ No circle ID provided')
    console.error('   Usage: npx tsx scripts/cleanup-test-circle.ts <circle-id>')
    console.error('   Or create a .test-circle-id file with the circle ID')
    process.exit(1)
  }

  console.log(`🧹 Cleaning up test circle: ${targetCircleId}\n`)

  try {
    // Verify it's a test circle
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select('id, name')
      .eq('id', targetCircleId)
      .single()

    if (circleError || !circle) {
      console.error('❌ Circle not found:', targetCircleId)
      process.exit(1)
    }

    if (!circle.name.includes('TEST')) {
      console.warn('⚠️  WARNING: Circle name does not contain "TEST"')
      console.warn(`   Name: ${circle.name}`)
      console.warn('   Are you sure you want to delete this circle?')
      console.warn('   This script will delete ALL data in this circle!')
      // In a real scenario, you might want to add a confirmation prompt here
    }

    // Get all reflections in this circle
    console.log('📝 Finding reflections...')
    const { data: reflections } = await supabase
      .from('reflections')
      .select('id, user_id, week_id, photo_url')
      .eq('circle_id', targetCircleId)

    if (reflections && reflections.length > 0) {
      console.log(`   Found ${reflections.length} reflection(s)`)

      // Delete photos from storage
      console.log('🗑️  Deleting photos from storage...')
      const photoUrls = reflections
        .map(r => r.photo_url)
        .filter((url): url is string => url !== null && url !== '')

      if (photoUrls.length > 0) {
        // Extract file paths from URLs
        const filePaths = photoUrls.map(url => {
          // Extract path from Supabase storage URL
          // Format: https://[project].supabase.co/storage/v1/object/public/photos/[path]
          const match = url.match(/\/photos\/(.+)$/)
          return match ? match[1] : null
        }).filter((path): path is string => path !== null)

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('photos')
            .remove(filePaths)

          if (storageError) {
            console.warn('⚠️  Could not delete some photos:', storageError.message)
          } else {
            console.log(`   ✅ Deleted ${filePaths.length} photo(s)`)
          }
        }
      }

      // Delete reflections
      console.log('🗑️  Deleting reflections...')
      const { error: reflectionsError } = await supabase
        .from('reflections')
        .delete()
        .eq('circle_id', targetCircleId)

      if (reflectionsError) {
        throw reflectionsError
      }
      console.log(`   ✅ Deleted ${reflections.length} reflection(s)`)
    } else {
      console.log('   No reflections found')
    }

    // Delete circle members
    console.log('🗑️  Deleting circle members...')
    const { error: membersError } = await supabase
      .from('circle_members')
      .delete()
      .eq('circle_id', targetCircleId)

    if (membersError) {
      throw membersError
    }
    console.log('   ✅ Deleted circle members')

    // Delete the circle
    console.log('🗑️  Deleting circle...')
    const { error: deleteError } = await supabase
      .from('circles')
      .delete()
      .eq('id', targetCircleId)

    if (deleteError) {
      throw deleteError
    }
    console.log('   ✅ Deleted circle')

    // Clean up test data file
    const testDataFile = join(process.cwd(), '.test-circle-id')
    if (existsSync(testDataFile)) {
      unlinkSync(testDataFile)
      console.log(`\n💾 Removed ${testDataFile}`)
    }

    console.log('\n✅ Test circle cleanup complete!')

  } catch (error) {
    console.error('❌ Error cleaning up test circle:', error)
    process.exit(1)
  }
}

// Get circle ID from command line args
const circleId = process.argv[2]
cleanupTestCircle(circleId)
