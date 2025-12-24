import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCircleUnlocked } from '@/lib/supabase/unlock'
import { ReviewDisplay } from './review-display'

type ReflectionWithAuthor = {
  reflection_id: string
  user_id: string
  first_name: string
  rose_text: string | null
  bud_text: string | null
  thorn_text: string | null
  rose_audio_url: string | null
  bud_audio_url: string | null
  thorn_audio_url: string | null
  rose_transcript: string | null
  bud_transcript: string | null
  thorn_transcript: string | null
  submitted_at: string | null
}

type CommentWithAuthor = {
  id: string
  reflection_id: string
  user_id: string
  comment_text: string
  created_at: string
  commenter_name: string
}

type WeekReviewPageProps = {
  params: Promise<{ weekId: string }>
  searchParams: Promise<{ circleId?: string }>
}

export default async function WeekReviewPage({
  params,
  searchParams,
}: WeekReviewPageProps) {
  const supabase = await createClient()
  const { weekId } = await params
  const params_search = await searchParams
  const selectedCircleId = params_search.circleId

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/invite')
  }

  // Get week details
  const { data: week, error: weekError } = await supabase
    .from('weeks')
    .select('id, start_at, end_at')
    .eq('id', weekId)
    .single()

  if (weekError || !week) {
    notFound()
  }

  // Check if week is in the past
  const weekEnd = new Date(week.end_at)
  if (weekEnd >= new Date()) {
    redirect('/home')
  }

  // Get all user's circle memberships
  const { data: memberships } = await supabase
    .from('circle_members')
    .select('circle_id')
    .eq('user_id', user.id)

  if (!memberships || memberships.length === 0) {
    redirect('/home')
  }

  // Determine which circle to use
  const circleIds = memberships.map(m => m.circle_id)
  const circleId = selectedCircleId && circleIds.includes(selectedCircleId)
    ? selectedCircleId
    : circleIds[0]

  // Check if circle was unlocked for this week
  const wasUnlocked = await isCircleUnlocked(circleId, weekId, supabase)

  if (!wasUnlocked) {
    redirect(selectedCircleId ? `/review?circleId=${selectedCircleId}` : '/review')
  }

  // Get all circle members
  const { data: allMembers } = await supabase
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', circleId)

  if (!allMembers || allMembers.length === 0) {
    redirect('/home')
  }

  const memberUserIds = allMembers.map(m => m.user_id)

  // Get all reflections for this week and circle (including own)
  const { data: reflections, error: reflectionsError } = await supabase
    .from('reflections')
    .select(`
      id,
      user_id,
      rose_text,
      bud_text,
      thorn_text,
      rose_audio_url,
      bud_audio_url,
      thorn_audio_url,
      rose_transcript,
      bud_transcript,
      thorn_transcript,
      submitted_at
    `)
    .eq('circle_id', circleId)
    .eq('week_id', weekId)
    .not('submitted_at', 'is', null)
    .in('user_id', memberUserIds)

  if (reflectionsError || !reflections || reflections.length === 0) {
    // No reflections found for this week - redirect back to review page
    redirect('/review')
  }

  // Get profiles for all reflection authors
  const reflectionUserIds = [...new Set(reflections.map(r => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name')
    .in('id', reflectionUserIds)

  const profileMap = new Map<string, string>()
  if (profiles) {
    profiles.forEach(p => {
      profileMap.set(p.id, p.first_name || 'Friend')
    })
  }

  // Transform reflections with author names
  const reflectionsWithAuthors: ReflectionWithAuthor[] = reflections
    .map(r => ({
      reflection_id: r.id,
      user_id: r.user_id,
      first_name: profileMap.get(r.user_id) || 'Friend',
      rose_text: r.rose_text,
      bud_text: r.bud_text,
      thorn_text: r.thorn_text,
      rose_audio_url: r.rose_audio_url,
      bud_audio_url: r.bud_audio_url,
      thorn_audio_url: r.thorn_audio_url,
      rose_transcript: r.rose_transcript,
      bud_transcript: r.bud_transcript,
      thorn_transcript: r.thorn_transcript,
      submitted_at: r.submitted_at,
    }))
    .sort((a, b) => a.first_name.localeCompare(b.first_name))

  // Get all comments for these reflections
  const reflectionIds = reflections.map(r => r.id)
  const { data: commentsData } = await supabase
    .from('comments')
    .select(`
      id,
      reflection_id,
      user_id,
      comment_text,
      created_at
    `)
    .in('reflection_id', reflectionIds)
    .order('created_at', { ascending: true })

  // Get commenter profiles
  const commentsWithAuthors: CommentWithAuthor[] = []
  if (commentsData && commentsData.length > 0) {
    const commenterIds = [...new Set(commentsData.map(c => c.user_id))]
    const { data: commenterProfiles } = await supabase
      .from('profiles')
      .select('id, first_name')
      .in('id', commenterIds)

    const commenterMap = new Map<string, string>()
    if (commenterProfiles) {
      commenterProfiles.forEach(p => {
        commenterMap.set(p.id, p.first_name || 'Friend')
      })
    }

    commentsData.forEach(c => {
      commentsWithAuthors.push({
        id: c.id,
        reflection_id: c.reflection_id,
        user_id: c.user_id,
        comment_text: c.comment_text,
        created_at: c.created_at,
        commenter_name: commenterMap.get(c.user_id) || 'Friend',
      })
    })
  }

  // Group comments by reflection_id
  const commentsByReflection = new Map<string, CommentWithAuthor[]>()
  commentsWithAuthors.forEach(comment => {
    const existing = commentsByReflection.get(comment.reflection_id) || []
    commentsByReflection.set(comment.reflection_id, [...existing, comment])
  })

  return (
    <ReviewDisplay
      weekId={weekId}
      weekStart={week.start_at}
      weekEnd={week.end_at}
      reflections={reflectionsWithAuthors}
      commentsByReflection={commentsByReflection}
      currentUserId={user.id}
      wasUnlocked={wasUnlocked}
    />
  )
}
