/**
 * SMS helper utilities for message formatting
 */

/**
 * Append STOP opt-out language to SMS messages
 * This is required for Twilio A2P 10DLC compliance
 * @param message - The original message text
 * @returns Message with STOP language appended
 */
export function appendStopLanguage(message: string): string {
  return `${message}\n\nReply STOP to opt out.`
}

