// Script to set up Supabase Storage bucket and policies for audio recordings
// Run with: npx tsx scripts/setup-storage.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('   Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupStorage() {
  console.log('🔧 Setting up Supabase Storage for audio recordings...\n')

  const bucketName = 'audio'

  // Check if bucket already exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()

  if (listError) {
    console.error('❌ Error listing buckets:', listError.message)
    process.exit(1)
  }

  const bucketExists = buckets?.some(b => b.name === bucketName)

  if (bucketExists) {
    console.log(`✅ Bucket "${bucketName}" already exists\n`)
  } else {
    console.log(`📦 Creating bucket "${bucketName}"...`)
    
    // Create bucket
    const { data: bucket, error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true, // Make bucket public so audio URLs can be accessed
      fileSizeLimit: 10485760, // 10MB limit
      allowedMimeTypes: ['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg'],
    })

    if (createError) {
      console.error('❌ Error creating bucket:', createError.message)
      console.error('\n💡 You may need to create the bucket manually in the Supabase Dashboard:')
      console.error('   1. Go to Storage → Buckets')
      console.error('   2. Click "New bucket"')
      console.error(`   3. Name: "${bucketName}"`)
      console.error('   4. Public bucket: Yes')
      console.error('   5. Create bucket')
      process.exit(1)
    }

    console.log(`✅ Bucket "${bucketName}" created successfully\n`)
  }

  // Note: Storage policies need to be set via SQL or Dashboard
  // The Supabase JS client doesn't have a direct API for creating storage policies
  console.log('📋 Storage policies need to be set manually:')
  console.log('\n   Option 1: Via Supabase Dashboard')
  console.log('   1. Go to Storage → Policies → audio bucket')
  console.log('   2. Create the following policies:\n')
  
  console.log('   Policy 1: "Users can upload their own audio"')
  console.log('   - Operation: INSERT')
  console.log('   - Policy:')
  console.log('     (bucket_id = \'audio\'::text) AND (auth.uid()::text = (storage.foldername(name))[1])\n')
  
  console.log('   Policy 2: "Users can read audio files"')
  console.log('   - Operation: SELECT')
  console.log('   - Policy:')
  console.log('     bucket_id = \'audio\'::text\n')
  
  console.log('   Policy 3: "Users can delete their own audio"')
  console.log('   - Operation: DELETE')
  console.log('   - Policy:')
  console.log('     (bucket_id = \'audio\'::text) AND (auth.uid()::text = (storage.foldername(name))[1])\n')

  console.log('   Option 2: Via SQL Editor')
  console.log('   Run the SQL from: supabase/migrations/20250121000016_setup_audio_storage.sql\n')

  console.log('✅ Storage bucket setup complete!')
  console.log('⚠️  Don\'t forget to set up the storage policies (see above)')
}

setupStorage().catch(console.error)


