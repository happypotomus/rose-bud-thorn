import twilio from 'twilio'

/**
 * Normalize phone number to E.164 format
 * Handles numbers with or without + prefix, with or without country code
 * Assumes US numbers (country code +1) if no country code is present
 * @param phone - Phone number in various formats
 * @returns Phone number in E.164 format (e.g., +15199010648)
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  // If it already starts with +, return as is (assuming it's already in E.164)
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  
  // If it starts with 1 and has 11 digits, add +
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+' + cleaned
  }
  
  // If it has 10 digits, assume US number and add +1
  if (cleaned.length === 10) {
    return '+1' + cleaned
  }
  
  // If it has 11 digits and doesn't start with 1, assume it's missing the +1
  if (cleaned.length === 11 && !cleaned.startsWith('1')) {
    return '+1' + cleaned
  }
  
  // If it's already 11 digits starting with 1, just add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return '+' + cleaned
  }
  
  // Fallback: try to add +1 if it looks like a US number
  // This handles edge cases
  return '+1' + cleaned
}

/**
 * Send an SMS message using Twilio
 * @param to - Phone number to send to (will be normalized to E.164 format)
 * @param message - Message body to send
 * @returns Promise with message SID if successful, throws error if failed
 */
export async function sendSMS(to: string, message: string): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    const missing = []
    if (!accountSid) missing.push('TWILIO_ACCOUNT_SID')
    if (!authToken) missing.push('TWILIO_AUTH_TOKEN')
    if (!fromNumber) missing.push('TWILIO_PHONE_NUMBER')
    throw new Error(`Missing Twilio credentials: ${missing.join(', ')}. Please check your environment variables.`)
  }

  // Normalize phone number to E.164 format
  const normalizedPhone = normalizePhoneNumber(to)

  const client = twilio(accountSid, authToken)

  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: normalizedPhone,
    })

    return result.sid
  } catch (error: any) {
    console.error('Twilio SMS error:', {
      message: error.message,
      code: error.code,
      status: error.status,
      phone: normalizedPhone,
      originalPhone: to,
    })
    
    // Preserve opt-out error code for handling upstream
    if (error.code === 21610) {
      const optOutError = new Error(`User has opted out: ${error.message}`)
      ;(optOutError as any).code = 21610
      throw optOutError
    }
    
    throw new Error(`Failed to send SMS: ${error.message}`)
  }
}

