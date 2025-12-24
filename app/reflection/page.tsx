import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek } from '@/lib/supabase/week-server'
import { didUserJoinMidWeek } from '@/lib/supabase/midweek-join'
import { ReflectionForm } from './reflection-form'

export default async function ReflectionPage() {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/invite')
  }

  // Get current week
  const currentWeek = await getCurrentWeek()
  
  if (!currentWeek) {
    redirect('/home')
  }

  // Get user's circle memberships
  const { data: memberships } = await supabase
    .from('circle_members')
    .select('circle_id, created_at')
    .eq('user_id', user.id)

  if (!memberships || memberships.length === 0) {
    redirect('/home')
  }

  // Check if user joined mid-week for ALL circles (after the current week started)
  // If user joined mid-week in all circles, redirect to home
  const joinedMidWeekChecks = await Promise.all(
    memberships.map(m => didUserJoinMidWeek(user.id, currentWeek.id))
  )
  const allJoinedMidWeek = joinedMidWeekChecks.every(joined => joined)

  if (allJoinedMidWeek) {
    // User joined mid-week in all circles - redirect to home
    redirect('/home')
  }

  // Check if user has already submitted a reflection for this week in ANY circle
  const circleIds = memberships.map(m => m.circle_id)
  const { data: existingReflection } = await supabase
    .from('reflections')
    .select('id')
    .eq('user_id', user.id)
    .eq('week_id', currentWeek.id)
    .in('circle_id', circleIds)
    .not('submitted_at', 'is', null)
    .maybeSingle()

  if (existingReflection) {
    // User has already submitted for this week - redirect to home
    redirect('/home')
  }

  // All checks passed - render the reflection form
  return (
    <ReflectionForm 
      weekId={currentWeek.id}
      userId={user.id}
    />
  )
}
