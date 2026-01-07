-- Create a function to execute dynamic SELECT queries safely
-- This function is SECURITY DEFINER so it runs with elevated privileges
-- but it only allows SELECT queries for security

CREATE OR REPLACE FUNCTION exec_sql(query_text TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  normalized_query TEXT;
BEGIN
  -- Normalize the query (trim and convert to uppercase for checking)
  normalized_query := UPPER(TRIM(query_text));
  
  -- Security check: Only allow SELECT or WITH (CTE) statements
  IF NOT (normalized_query LIKE 'SELECT%' OR normalized_query LIKE 'WITH%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed. Query must start with SELECT or WITH.';
  END IF;
  
  -- Block dangerous keywords
  IF normalized_query ~ '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|CALL)\b' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords. Only SELECT queries are allowed.';
  END IF;
  
  -- Execute the query and return results as JSON
  -- Use EXECUTE to run dynamic SQL
  EXECUTE format('SELECT json_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;
  
  -- Return empty array if no results
  IF result IS NULL THEN
    result := '[]'::JSON;
  END IF;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information as JSON
    RETURN json_build_object(
      'error', true,
      'message', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
-- (though this will be called via service role in practice)
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;

