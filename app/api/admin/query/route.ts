import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { translateToSQL } from '@/lib/openai/sql-translator'

const ADMIN_USER_ID = 'f1c36939-dee5-4305-8dca-af25d538ab65'

/**
 * Validates that SQL is SELECT-only (read-only)
 */
function isValidSelectQuery(sql: string): boolean {
  const normalizedSQL = sql.trim().toUpperCase()
  
  // Must start with SELECT or WITH (for CTEs)
  if (!normalizedSQL.startsWith('SELECT') && !normalizedSQL.startsWith('WITH')) {
    return false
  }
  
  // Block dangerous keywords
  const dangerousKeywords = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'ALTER',
    'CREATE',
    'TRUNCATE',
    'GRANT',
    'REVOKE',
    'EXEC',
    'EXECUTE',
    'CALL',
  ]
  
  // Check for dangerous keywords (case-insensitive)
  for (const keyword of dangerousKeywords) {
    // Use word boundaries to avoid false positives (e.g., "SELECT" in a comment)
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    if (regex.test(sql)) {
      return false
    }
  }
  
  return true
}

/**
 * POST /api/admin/query
 * 
 * Executes a natural language query by translating it to SQL and executing it.
 * Only accessible to the admin user.
 * 
 * Body:
 * {
 *   query: string (natural language query)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is admin
    if (user.id !== ADMIN_USER_ID) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { query } = body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid query' },
        { status: 400 }
      )
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Translate natural language to SQL
    const sql = await translateToSQL(query.trim())

    if (!sql) {
      return NextResponse.json(
        { error: 'Failed to translate query to SQL' },
        { status: 500 }
      )
    }

    // Validate SQL is SELECT-only
    if (!isValidSelectQuery(sql)) {
      return NextResponse.json(
        { 
          error: 'Invalid SQL: Only SELECT queries are allowed',
          sql: sql // Include SQL for debugging
        },
        { status: 400 }
      )
    }

    // Execute SQL using service role client to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey)

    // Execute SQL using the exec_sql RPC function
    const { data, error } = await serviceSupabase.rpc('exec_sql', {
      query_text: sql,
    })

    if (error) {
      console.error('Database query error:', error)
      return NextResponse.json(
        { 
          error: 'Database query failed',
          details: error.message,
          sql: sql
        },
        { status: 500 }
      )
    }

    // Check if the result contains an error
    if (data && typeof data === 'object' && 'error' in data && data.error === true) {
      return NextResponse.json(
        { 
          error: 'Database query failed',
          details: data.message || 'Unknown error',
          sql: sql
        },
        { status: 500 }
      )
    }

    // Parse the JSON result
    const rows = Array.isArray(data) ? data : []
    
    // Extract column names from first row if available
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []

    return NextResponse.json({
      success: true,
      sql: sql,
      rows: rows,
      rowCount: rows.length,
      columns: columns,
    })
  } catch (error) {
    console.error('Error in admin query route:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

