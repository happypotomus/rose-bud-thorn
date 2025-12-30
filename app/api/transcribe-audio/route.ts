import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { transcribeAndClean } from '@/lib/openai/transcribe'

/**
 * POST /api/transcribe-audio
 * 
 * Transcribes audio files for a reflection submission.
 * 
 * Body:
 * {
 *   reflectionId: string (UUID of the reflection)
 *   audioUrls: {
 *     rose?: string | null
 *     bud?: string | null
 *     thorn?: string | null
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { reflectionId } = body

    if (!reflectionId) {
      return NextResponse.json(
        { error: 'Missing reflectionId' },
        { status: 400 }
      )
    }

    // Verify that the reflection belongs to the current user
    const { data: reflection, error: reflectionError } = await supabase
      .from('reflections')
      .select('user_id, week_id, rose_audio_url, bud_audio_url, thorn_audio_url')
      .eq('id', reflectionId)
      .single()

    if (reflectionError || !reflection) {
      return NextResponse.json(
        { error: 'Reflection not found' },
        { status: 404 }
      )
    }

    if (reflection.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Transcribe each audio URL that exists in the reflection
    const updates: {
      rose_transcript?: string | null
      bud_transcript?: string | null
      thorn_transcript?: string | null
    } = {}

    const transcriptionPromises: Promise<void>[] = []

    // Transcribe rose audio (use URL from database, not request body)
    if (reflection.rose_audio_url) {
      transcriptionPromises.push(
        transcribeAndClean(reflection.rose_audio_url)
          .then((transcript) => {
            if (transcript) {
              updates.rose_transcript = transcript
            } else {
              updates.rose_transcript = null
            }
          })
          .catch((error) => {
            console.error('Error transcribing rose audio:', error)
            // Leave transcript as null if transcription fails
            updates.rose_transcript = null
          })
      )
    }

    // Transcribe bud audio
    if (reflection.bud_audio_url) {
      transcriptionPromises.push(
        transcribeAndClean(reflection.bud_audio_url)
          .then((transcript) => {
            if (transcript) {
              updates.bud_transcript = transcript
            } else {
              updates.bud_transcript = null
            }
          })
          .catch((error) => {
            console.error('Error transcribing bud audio:', error)
            updates.bud_transcript = null
          })
      )
    }

    // Transcribe thorn audio
    if (reflection.thorn_audio_url) {
      transcriptionPromises.push(
        transcribeAndClean(reflection.thorn_audio_url)
          .then((transcript) => {
            if (transcript) {
              updates.thorn_transcript = transcript
            } else {
              updates.thorn_transcript = null
            }
          })
          .catch((error) => {
            console.error('Error transcribing thorn audio:', error)
            updates.thorn_transcript = null
          })
      )
    }

    // Wait for all transcriptions to complete
    await Promise.all(transcriptionPromises)

    // Update ALL reflections for this user/week with transcripts
    // Since reflections are inserted into multiple circles, we need to update all of them
    // Use service role client to bypass RLS and ensure all reflections are found and updated
    if (Object.keys(updates).length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing Supabase service role key for transcript updates')
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        )
      }

      const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey)

      // Find all reflections for this user/week (they're identical across circles)
      // Use service role to bypass RLS and find ALL reflections regardless of circle
      const { data: allReflectionsForWeek, error: findError } = await serviceSupabase
        .from('reflections')
        .select('id, circle_id')
        .eq('user_id', reflection.user_id)
        .eq('week_id', reflection.week_id)
        .not('submitted_at', 'is', null)

      if (findError) {
        console.error('Error finding reflections to update:', findError)
        return NextResponse.json(
          { error: 'Failed to find reflections to update', details: findError.message },
          { status: 500 }
        )
      }

      if (!allReflectionsForWeek || allReflectionsForWeek.length === 0) {
        console.error('No reflections found for user/week')
        return NextResponse.json(
          { error: 'No reflections found to update' },
          { status: 404 }
        )
      }

      console.log(`[TRANSCRIBE] Found ${allReflectionsForWeek.length} reflection(s) to update for user/week`)

      // Update all reflections with the same transcripts
      // Use service role to bypass RLS and update ALL reflections
      const allReflectionIds = allReflectionsForWeek.map(r => r.id)
      const { error: updateError } = await serviceSupabase
        .from('reflections')
        .update(updates)
        .in('id', allReflectionIds)

      if (updateError) {
        console.error('Error updating transcripts:', updateError)
        return NextResponse.json(
          { error: 'Failed to save transcripts', details: updateError.message },
          { status: 500 }
        )
      }

      console.log(`[TRANSCRIBE] Successfully updated ${allReflectionIds.length} reflection(s) with transcripts`)
    }

    return NextResponse.json({
      success: true,
      transcripts: {
        rose: updates.rose_transcript !== undefined,
        bud: updates.bud_transcript !== undefined,
        thorn: updates.thorn_transcript !== undefined,
      },
    })
  } catch (error) {
    console.error('Error in transcribe-audio route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

