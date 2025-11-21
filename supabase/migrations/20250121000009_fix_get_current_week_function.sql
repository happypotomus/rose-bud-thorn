-- Fix the get_or_create_current_week function
-- Simplify the date calculation logic to be more reliable

CREATE OR REPLACE FUNCTION get_or_create_current_week()
RETURNS TABLE (
  id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_time TIMESTAMPTZ := NOW();
  week_start TIMESTAMPTZ;
  week_end TIMESTAMPTZ;
  found_week RECORD;
  day_of_week INT;
  hours_since_sunday INT;
BEGIN
  -- Try to find existing week where current_time is between start_at and end_at
  SELECT w.* INTO found_week
  FROM weeks w
  WHERE current_time >= w.start_at 
    AND current_time < w.end_at
  ORDER BY w.start_at DESC
  LIMIT 1;

  -- If week found, return it
  IF found_week IS NOT NULL THEN
    RETURN QUERY SELECT 
      found_week.id,
      found_week.start_at,
      found_week.end_at,
      found_week.created_at;
    RETURN;
  END IF;

  -- No week found, create a new one
  -- Calculate start_at: most recent Sunday 7pm
  day_of_week := EXTRACT(DOW FROM current_time); -- 0=Sunday, 6=Saturday
  hours_since_sunday := EXTRACT(HOUR FROM current_time);
  
  -- Calculate days to subtract to get to last Sunday
  IF day_of_week = 0 THEN
    -- It's Sunday
    IF hours_since_sunday < 19 THEN
      -- Before 7pm, go back 7 days
      week_start := DATE_TRUNC('day', current_time) - INTERVAL '7 days' + INTERVAL '19 hours';
    ELSE
      -- After 7pm, this is the start
      week_start := DATE_TRUNC('day', current_time) + INTERVAL '19 hours';
    END IF;
  ELSE
    -- Not Sunday, go back to last Sunday
    week_start := DATE_TRUNC('day', current_time) - (day_of_week || ' days')::INTERVAL + INTERVAL '19 hours';
  END IF;

  -- Calculate end_at: next Sunday 6:59pm (7 days later, minus 1 minute)
  week_end := week_start + INTERVAL '7 days' - INTERVAL '1 minute';

  -- Insert new week
  INSERT INTO weeks (start_at, end_at)
  VALUES (week_start, week_end)
  RETURNING weeks.id, weeks.start_at, weeks.end_at, weeks.created_at
  INTO found_week.id, found_week.start_at, found_week.end_at, found_week.created_at;

  -- Return the newly created week
  RETURN QUERY SELECT 
    found_week.id,
    found_week.start_at,
    found_week.end_at,
    found_week.created_at;
END;
$$;

