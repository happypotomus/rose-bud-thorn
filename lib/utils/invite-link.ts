/**
 * Utility to generate or update invite links for circles
 * This ensures invite_link always has the correct base URL
 */

export function generateInviteLink(token: string, baseUrl?: string): string {
  const url = baseUrl || 
    process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rose-bud-thorn.vercel.app')
  
  return `${url}/invite-landing?token=${token}`
}

/**
 * Update invite_link for a circle in the database
 * Call this after creating a circle to ensure the link has the correct base URL
 */
export async function updateCircleInviteLink(
  supabase: any,
  circleId: string,
  token: string,
  baseUrl?: string
): Promise<void> {
  const inviteLink = generateInviteLink(token, baseUrl)
  
  await supabase
    .from('circles')
    .update({ invite_link: inviteLink })
    .eq('id', circleId)
}


