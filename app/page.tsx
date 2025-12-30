import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect root to /invite
  // This is a fallback in case next.config.mjs redirect doesn't catch it
  redirect('/invite')
}
