import twilio from 'twilio'

/**
 * Send an SMS message using Twilio
 * @param to - Phone number to send to (E.164 format, e.g., +1234567890)
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

  const client = twilio(accountSid, authToken)

  try {
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to,
    })

    return result.sid
  } catch (error: any) {
    console.error('Twilio SMS error:', {
      message: error.message,
      code: error.code,
      status: error.status,
    })
    throw new Error(`Failed to send SMS: ${error.message}`)
  }
}

