import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShareForm } from './share-form'

type SearchParams = {
  reflectionId?: string
  circleId?: string
}

export default async function ReflectionSharePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const { reflectionId, circleId } = searchParams
    const redirectUrl = reflectionId && circleId
      ? `/reflection/share?reflectionId=${reflectionId}&circleId=${circleId}`
      : '/reflection/share'
    redirect(`/login?redirectTo=${encodeURIComponent(redirectUrl)}`)
  }

  const { reflectionId, circleId } = searchParams

  if (!reflectionId || !circleId) {
    redirect('/home')
  }

  // Fetch all circles user is a member of
  const { data: memberships, error: membershipsError } = await supabase
    .from('circle_members')
    .select(`
      circle_id,
      circles (
        id,
        name
      )
    `)
    .eq('user_id', user.id)

  if (membershipsError || !memberships || memberships.length === 0) {
    redirect('/home')
  }

  // Fetch the reflection that was just submitted
  const { data: reflection, error: reflectionError } = await supabase
    .from('reflections')
    .select('id, rose_text, bud_text, thorn_text, circle_id, week_id')
    .eq('id', reflectionId)
    .eq('user_id', user.id)
    .single()

  if (reflectionError || !reflection) {
    redirect('/home')
  }

  // Format circles data
  const circles = memberships.map((m) => {
    const circle = Array.isArray(m.circles) ? m.circles[0] : m.circles
    return {
      id: m.circle_id,
      name: circle?.name || 'Unknown Circle',
    }
  })

  return (
    <ShareForm
      reflectionId={reflectionId}
      originalCircleId={circleId}
      circles={circles}
      reflection={reflection}
    />
  )
}





