'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Comment = {
  id: string
  user_id: string
  comment_text: string
  created_at: string
  commenter_name: string
}

type CommentSectionProps = {
  reflectionId: string
  comments: Comment[]
  isUnlocked: boolean
  currentUserId: string | null
  onCommentAdded: () => void
}

export function CommentSection({
  reflectionId,
  comments,
  isUnlocked,
  currentUserId,
  onCommentAdded,
}: CommentSectionProps) {
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !currentUserId || submitting) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          reflection_id: reflectionId,
          user_id: currentUserId,
          comment_text: newComment.trim(),
        })

      if (error) {
        console.error('Error adding comment:', error)
        alert('Failed to add comment. Please try again.')
      } else {
        setNewComment('')
        onCommentAdded()
      }
    } catch (err) {
      console.error('Error adding comment:', err)
      alert('Failed to add comment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (!isUnlocked) {
    return null
  }

  return (
    <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-200">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 sm:mb-5">
        Comments
      </h3>

      {/* Existing Comments */}
      {comments.length > 0 && (
        <div className="space-y-4 sm:space-y-5 mb-6 sm:mb-8">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-50 rounded-lg p-3 sm:p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium text-gray-900 text-sm sm:text-base">
                  {comment.commenter_name}
                </span>
                <span className="text-xs sm:text-sm text-gray-500">
                  {formatDate(comment.created_at)}
                </span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base">
                {comment.comment_text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add Comment Form */}
      {currentUserId && (
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none text-sm sm:text-base"
            disabled={submitting}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-rose text-white rounded-lg hover:bg-rose-dark active:bg-rose-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base transition-colors"
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
