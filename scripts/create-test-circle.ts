/**
 * Script to create a test circle for functional testing
 * 
 * Usage:
 * 1. Make sure you have SUPABASE_SERVICE_ROLE_KEY in your environment
 * 2. Run: npx tsx scripts/create-test-circle.ts
 * 
 * This creates:
 * - A test circle with a clear name
 * - Adds you as a member
 * - Creates a test week (current week) if needed
 * 
 * Clean up with: npx tsx scripts/cleanup-test-circle.ts
 */

import { createClient } from '@supabase/supabase-js'

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

async function createTestCircle() {
  console.log('🧪 Creating test circle for functional testing...\n')

  try {
    // Get current user (you need to be authenticated)
    // For this script, we'll need to pass your user ID or get it from auth
    // For now, let's create a circle and you can manually add yourself
    
    const testCircleName = `TEST - Photo Upload ${new Date().toISOString().split('T')[0]}`
    const testInviteToken = `test-photo-upload-${Date.now()}`

    // Create test circle
    console.log('📝 Creating test circle...')
    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .insert({
        name: testCircleName,
        invite_token: testInviteToken,
        circle_owner: 'Test User',
      })
      .select()
      .single()

    if (circleError) {
      throw circleError
    }

    console.log('✅ Test circle created:')
    console.log(`   ID: ${circle.id}`)
    console.log(`   Name: ${circle.name}`)
    console.log(`   Invite Token: ${circle.invite_token}`)
    if (circle.invite_link) {
      console.log(`   Invite Link: ${circle.invite_link}`)
    }

    // Get or create current week
    console.log('\n📅 Getting current week...')
    const { data: week, error: weekError } = await supabase
      .rpc('get_or_create_current_week')

    if (weekError) {
      console.warn('⚠️  Could not get/create week:', weekError.message)
      console.log('   You may need to create a week manually in Supabase')
    } else {
      console.log('✅ Current week:')
      console.log(`   ID: ${week.id}`)
      console.log(`   Start: ${week.start_at}`)
      console.log(`   End: ${week.end_at}`)
    }

    console.log('\n✅ Test circle setup complete!')
    console.log('\n📋 Next steps:')
    console.log('   1. Go to your app and join the circle using the invite link')
    console.log('   2. Test photo uploads and submissions')
    console.log('   3. When done, run: npx tsx scripts/cleanup-test-circle.ts')
    console.log(`      (Circle ID: ${circle.id})`)

    // Save circle ID to a file for cleanup script
    try {
      const fs = await import('fs')
      const path = await import('path')
      const testDataFile = path.join(process.cwd(), '.test-circle-id')
      fs.writeFileSync(testDataFile, circle.id)
      console.log(`\n💾 Circle ID saved to ${testDataFile} for easy cleanup`)
    } catch (error) {
      console.warn('⚠️  Could not save circle ID to file:', error)
      console.log('   You can manually save the circle ID for cleanup')
    }

  } catch (error) {
    console.error('❌ Error creating test circle:', error)
    process.exit(1)
  }
}

createTestCircle()
