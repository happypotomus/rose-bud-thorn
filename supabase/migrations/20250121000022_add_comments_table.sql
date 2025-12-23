-- Add comments table for reflections
-- Users can comment on each other's reflections after circle unlocks

-- ============================================
-- 1. Create comments table
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reflection_id UUID NOT NULL REFERENCES reflections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_comments_reflection_id ON comments(reflection_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- ============================================
-- 3. Enable RLS
-- ============================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS Policies
-- ============================================

-- SELECT: Users can view comments on reflections in their circle
DROP POLICY IF EXISTS "View comments in own circle" ON comments;
CREATE POLICY "View comments in own circle" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reflections r
      JOIN circle_members cm ON r.circle_id = cm.circle_id
      WHERE r.id = comments.reflection_id
      AND cm.user_id = auth.uid()
    )
  );

-- INSERT: Users can add comments to reflections in their circle
DROP POLICY IF EXISTS "Add comments in own circle" ON comments;
CREATE POLICY "Add comments in own circle" ON comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM reflections r
      JOIN circle_members cm ON r.circle_id = cm.circle_id
      WHERE r.id = comments.reflection_id
      AND cm.user_id = auth.uid()
    )
  );

-- UPDATE: Users can only edit their own comments
DROP POLICY IF EXISTS "Update own comments" ON comments;
CREATE POLICY "Update own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own comments
DROP POLICY IF EXISTS "Delete own comments" ON comments;
CREATE POLICY "Delete own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);
