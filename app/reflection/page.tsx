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

  // Get user's circle membership
  const { data: membership } = await supabase
    .from('circle_members')
    .select('circle_id, created_at')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    redirect('/home')
  }

  // Check if user joined mid-week (after the current week started)
  const joinedMidWeek = await didUserJoinMidWeek(user.id, currentWeek.id)

  if (joinedMidWeek) {
    // User joined mid-week - redirect to home
    redirect('/home')
  }

  // Check if user has already submitted a reflection for this week
  const { data: existingReflection } = await supabase
    .from('reflections')
    .select('id')
    .eq('user_id', user.id)
    .eq('week_id', currentWeek.id)
    .eq('circle_id', membership.circle_id)
    .not('submitted_at', 'is', null)
    .maybeSingle()

  if (existingReflection) {
    // User has already submitted - redirect to home
    redirect('/home')
  }

  // All checks passed - render the reflection form
  return (
    <ReflectionForm 
      weekId={currentWeek.id}
      circleId={membership.circle_id}
      userId={user.id}
    />
  )
}
