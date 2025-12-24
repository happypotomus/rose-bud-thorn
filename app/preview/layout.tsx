import { notFound } from 'next/navigation'

// Only allow preview page in development
if (process.env.NODE_ENV === 'production') {
  notFound()
}

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
