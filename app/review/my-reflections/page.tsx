import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MyReflectionsDisplay } from './my-reflections-display'

type MyReflectionsPageProps = {
  searchParams: Promise<{ page?: string }>
}

type ReflectionWithWeek = {
  reflection_id: string
  week_id: string
  week_start: string
  week_end: string
  rose_text: string | null
  bud_text: string | null
  thorn_text: string | null
  rose_audio_url: string | null
  bud_audio_url: string | null
  thorn_audio_url: string | null
  rose_transcript: string | null
  bud_transcript: string | null
  thorn_transcript: string | null
  photo_url: string | null
  photo_caption: string | null
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

const PAGE_SIZE = 56

export default async function MyReflectionsPage({ searchParams }: MyReflectionsPageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10))
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const redirectUrl = `/review/my-reflections?page=${page}`
    redirect(`/login?redirectTo=${encodeURIComponent(redirectUrl)}`)
  }

  // Get all user's submitted reflections
  // Since reflections are the same across circles, we'll use DISTINCT ON week_id
  // to get one reflection per week
  const { data: allReflections, error: reflectionsError } = await supabase
    .from('reflections')
    .select(`
      id,
      week_id,
      rose_text,
      bud_text,
      thorn_text,
      rose_audio_url,
      bud_audio_url,
      thorn_audio_url,
      rose_transcript,
      bud_transcript,
      thorn_transcript,
      photo_url,
      photo_caption,
      submitted_at
    `)
    .eq('user_id', user.id)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })

  if (reflectionsError || !allReflections) {
    console.error('Error fetching reflections:', reflectionsError)
    redirect('/review')
  }

  // Get unique week_ids (since same reflection exists in multiple circles)
  const uniqueWeekIds = [...new Set(allReflections.map(r => r.week_id))]

  // Get week details for all unique weeks
  const { data: weeks, error: weeksError } = await supabase
    .from('weeks')
    .select('id, start_at, end_at')
    .in('id', uniqueWeekIds)
    .order('start_at', { ascending: false })

  if (weeksError || !weeks) {
    console.error('Error fetching weeks:', weeksError)
    redirect('/review')
  }

  // Create a map of week_id to week details
  const weekMap = new Map(weeks.map(w => [w.id, w]))

  // Group reflections by week_id and pick the first one (they're all identical)
  const reflectionsByWeek = new Map<string, typeof allReflections[0]>()
  for (const reflection of allReflections) {
    if (!reflectionsByWeek.has(reflection.week_id)) {
      reflectionsByWeek.set(reflection.week_id, reflection)
    }
  }

  // Create array of reflections with week info, sorted by week start_at descending
  const reflectionsWithWeeks: ReflectionWithWeek[] = Array.from(reflectionsByWeek.entries())
    .map(([weekId, reflection]) => {
      const week = weekMap.get(weekId)
      if (!week) return null
      return {
        reflection_id: reflection.id,
        week_id: weekId,
        week_start: week.start_at,
        week_end: week.end_at,
        rose_text: reflection.rose_text,
        bud_text: reflection.bud_text,
        thorn_text: reflection.thorn_text,
        rose_audio_url: reflection.rose_audio_url,
        bud_audio_url: reflection.bud_audio_url,
        thorn_audio_url: reflection.thorn_audio_url,
        rose_transcript: reflection.rose_transcript,
        bud_transcript: reflection.bud_transcript,
        thorn_transcript: reflection.thorn_transcript,
        photo_url: reflection.photo_url,
        photo_caption: reflection.photo_caption,
        submitted_at: reflection.submitted_at,
      }
    })
    .filter((r): r is ReflectionWithWeek => r !== null)
    .sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime())

  // Apply pagination
  const totalWeeks = reflectionsWithWeeks.length
  const totalPages = Math.ceil(totalWeeks / PAGE_SIZE)
  const startIndex = (page - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const paginatedReflections = reflectionsWithWeeks.slice(startIndex, endIndex)
  const hasMore = endIndex < totalWeeks

  // Get all reflection IDs for this page
  const reflectionIds = paginatedReflections.map(r => r.reflection_id)

  // Fetch all comments for these reflections
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

  // Get user's profile for display
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', user.id)
    .single()

  const userName = profile?.first_name || 'You'

  return (
    <MyReflectionsDisplay
      reflections={paginatedReflections}
      commentsByReflection={commentsByReflection}
      currentUserId={user.id}
      userName={userName}
      currentPage={page}
      hasMore={hasMore}
      totalWeeks={totalWeeks}
    />
  )
}
