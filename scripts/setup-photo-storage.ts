// Script to set up Supabase Storage bucket and policies for photo uploads
// Run with: npx tsx scripts/setup-photo-storage.ts

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('   Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupPhotoStorage() {
  console.log('🔧 Setting up Supabase Storage for photo uploads...\n')

  const bucketName = 'photos'

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
      public: true, // Make bucket public so photo URLs can be accessed
      fileSizeLimit: 5242880, // 5MB limit
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    })

    if (createError) {
      console.error('❌ Error creating bucket:', createError.message)
      console.error('\n💡 You may need to create the bucket manually in the Supabase Dashboard:')
      console.error('   1. Go to Storage → Buckets')
      console.error('   2. Click "New bucket"')
      console.error(`   3. Name: "${bucketName}"`)
      console.error('   4. Public bucket: Yes')
      console.error('   5. File size limit: 5MB (5242880 bytes)')
      console.error('   6. Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp, image/gif')
      console.error('   7. Create bucket')
      process.exit(1)
    }

    console.log(`✅ Bucket "${bucketName}" created successfully\n`)
  }

  // Note: Storage policies need to be set via SQL or Dashboard
  // The Supabase JS client doesn't have a direct API for creating storage policies
  console.log('📋 Storage policies need to be set manually:')
  console.log('\n   Option 1: Via Supabase Dashboard')
  console.log('   1. Go to Storage → Policies → photos bucket')
  console.log('   2. Create the following policies:\n')
  
  console.log('   Policy 1: "Users can upload their own photos"')
  console.log('   - Operation: INSERT')
  console.log('   - Policy:')
  console.log('     (bucket_id = \'photos\'::text) AND (auth.uid()::text = (storage.foldername(name))[1])\n')
  
  console.log('   Policy 2: "Users can read photos"')
  console.log('   - Operation: SELECT')
  console.log('   - Policy:')
  console.log('     bucket_id = \'photos\'::text\n')
  
  console.log('   Policy 3: "Users can delete their own photos"')
  console.log('   - Operation: DELETE')
  console.log('   - Policy:')
  console.log('     (bucket_id = \'photos\'::text) AND (auth.uid()::text = (storage.foldername(name))[1])\n')

  console.log('   Option 2: Via SQL Editor')
  console.log('   Run the SQL from: supabase/migrations/20250121000025_setup_photo_storage.sql\n')

  console.log('✅ Storage bucket setup complete!')
  console.log('⚠️  Don\'t forget to set up the storage policies (see above)')
}

setupPhotoStorage().catch(console.error)
