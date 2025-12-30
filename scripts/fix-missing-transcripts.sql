-- Script to retroactively fix missing transcripts
-- Copies transcripts from one reflection instance to all other instances for the same user/week
-- Run this directly in Supabase SQL Editor

-- Step 1: Find reflections that have transcripts in one circle but missing in others
-- For each user/week combination, find the reflection with transcripts and copy to others

DO $$
DECLARE
  reflection_record RECORD;
  source_reflection RECORD;
  target_reflection RECORD;
  updates_count INTEGER := 0;
BEGIN
  -- Loop through each unique user/week combination
  FOR reflection_record IN 
    SELECT DISTINCT user_id, week_id
    FROM reflections
    WHERE submitted_at IS NOT NULL
  LOOP
    -- Find a reflection with transcripts for this user/week (source)
    SELECT id, circle_id, rose_transcript, bud_transcript, thorn_transcript
    INTO source_reflection
    FROM reflections
    WHERE user_id = reflection_record.user_id
      AND week_id = reflection_record.week_id
      AND submitted_at IS NOT NULL
      AND (rose_transcript IS NOT NULL 
           OR bud_transcript IS NOT NULL 
           OR thorn_transcript IS NOT NULL)
    LIMIT 1;

    -- If we found a source with transcripts, update all other reflections for this user/week
    IF source_reflection.id IS NOT NULL THEN
      -- Update all reflections for this user/week that are missing transcripts
      FOR target_reflection IN
        SELECT id, circle_id, rose_transcript, bud_transcript, thorn_transcript
        FROM reflections
        WHERE user_id = reflection_record.user_id
          AND week_id = reflection_record.week_id
          AND submitted_at IS NOT NULL
          AND id != source_reflection.id
      LOOP
        -- Build update statement only for fields that need updating
        UPDATE reflections
        SET 
          rose_transcript = CASE 
            WHEN source_reflection.rose_transcript IS NOT NULL 
                 AND target_reflection.rose_transcript IS NULL 
            THEN source_reflection.rose_transcript 
            ELSE target_reflection.rose_transcript 
          END,
          bud_transcript = CASE 
            WHEN source_reflection.bud_transcript IS NOT NULL 
                 AND target_reflection.bud_transcript IS NULL 
            THEN source_reflection.bud_transcript 
            ELSE target_reflection.bud_transcript 
          END,
          thorn_transcript = CASE 
            WHEN source_reflection.thorn_transcript IS NOT NULL 
                 AND target_reflection.thorn_transcript IS NULL 
            THEN source_reflection.thorn_transcript 
            ELSE target_reflection.thorn_transcript 
          END
        WHERE id = target_reflection.id
          AND (
            (source_reflection.rose_transcript IS NOT NULL AND target_reflection.rose_transcript IS NULL)
            OR (source_reflection.bud_transcript IS NOT NULL AND target_reflection.bud_transcript IS NULL)
            OR (source_reflection.thorn_transcript IS NOT NULL AND target_reflection.thorn_transcript IS NULL)
          );

        -- Check if any rows were updated
        IF FOUND THEN
          updates_count := updates_count + 1;
          RAISE NOTICE 'Updated reflection % (circle: %) for user % / week %', 
            target_reflection.id, 
            target_reflection.circle_id,
            reflection_record.user_id,
            reflection_record.week_id;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Completed: Updated % reflection(s) with missing transcripts', updates_count;
END $$;

-- Verify the fix
SELECT 
  user_id,
  week_id,
  circle_id,
  CASE WHEN rose_transcript IS NOT NULL THEN 'YES' ELSE 'NO' END as has_rose,
  CASE WHEN bud_transcript IS NOT NULL THEN 'YES' ELSE 'NO' END as has_bud,
  CASE WHEN thorn_transcript IS NOT NULL THEN 'YES' ELSE 'NO' END as has_thorn
FROM reflections
WHERE submitted_at IS NOT NULL
ORDER BY user_id, week_id, circle_id;
