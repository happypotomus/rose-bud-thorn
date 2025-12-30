'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FlowerLogo } from '@/components/flower-logo'

type PhoneVerificationStepProps = {
  onVerified: (userId: string, firstName: string, phone: string) => void
}

export function PhoneVerificationStep({ onVerified }: PhoneVerificationStepProps) {
  const [firstName, setFirstName] = useState('')
  const [countryCode, setCountryCode] = useState('+1')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  
  const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`
  const supabase = createClient()

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Send OTP via Supabase (phone is in E.164 format)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
        options: {
          data: {
            first_name: firstName,
          },
        },
      })

      if (otpError) {
        setError(otpError.message || 'Failed to send OTP. Please try again.')
        setLoading(false)
        return
      }

      setOtpSent(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Verify OTP
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: otp,
        type: 'sms',
      })

      if (verifyError || !authData.user) {
        setError(verifyError?.message || 'Invalid OTP. Please try again.')
        setLoading(false)
        return
      }

      // Create profile (no invite token needed for new user onboarding)
      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authData.user.id,
          firstName,
          phone: fullPhoneNumber,
          // No inviteToken for new user onboarding
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to complete setup. Please try again.')
        setLoading(false)
        return
      }

      // Call onVerified callback with user data
      onVerified(authData.user.id, firstName, fullPhoneNumber)
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (otpSent) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 bg-white pt-safe pb-safe">
        <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl space-y-5 sm:space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4 sm:mb-6">
              <FlowerLogo size={56} className="sm:w-16 sm:h-16" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3 text-black px-2">Verify Your Phone</h1>
            <p className="text-gray-600 text-sm sm:text-base md:text-lg px-2">
              We sent a code to {fullPhoneNumber}. Please enter it below.
            </p>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium mb-2 text-black">
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full px-4 py-3.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent text-base text-center text-2xl tracking-widest touch-manipulation min-h-[44px]"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-rose text-white py-3.5 sm:py-3 px-6 rounded-lg hover:bg-rose-dark active:bg-rose-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6 sm:py-8 bg-white pt-safe pb-safe">
      <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl space-y-5 sm:space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4 sm:mb-6">
            <FlowerLogo size={56} className="sm:w-16 sm:h-16" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3 text-black px-2">Create Your Account</h1>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg px-2">
            Enter your information to get started.
          </p>
        </div>

        <form onSubmit={handleSendOTP} className="space-y-4 sm:space-y-5">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium mb-2 text-black">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              required
              autoComplete="given-name"
              className="w-full px-4 py-3.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent text-base touch-manipulation min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-2 text-black">
              Phone Number
            </label>
            <div className="flex gap-2">
              <select
                id="countryCode"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="px-3 sm:px-4 py-3.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent text-base touch-manipulation min-h-[44px] bg-white"
                style={{ width: 'auto', minWidth: '100px' }}
              >
                <option value="+1">🇨🇦 +1</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+61">🇦🇺 +61</option>
                <option value="+33">🇫🇷 +33</option>
                <option value="+49">🇩🇪 +49</option>
                <option value="+81">🇯🇵 +81</option>
                <option value="+86">🇨🇳 +86</option>
                <option value="+91">🇮🇳 +91</option>
                <option value="+52">🇲🇽 +52</option>
                <option value="+55">🇧🇷 +55</option>
                <option value="+34">🇪🇸 +34</option>
                <option value="+39">🇮🇹 +39</option>
                <option value="+31">🇳🇱 +31</option>
                <option value="+46">🇸🇪 +46</option>
                <option value="+47">🇳🇴 +47</option>
                <option value="+41">🇨🇭 +41</option>
                <option value="+32">🇧🇪 +32</option>
                <option value="+353">🇮🇪 +353</option>
                <option value="+64">🇳🇿 +64</option>
                <option value="+27">🇿🇦 +27</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+65">🇸🇬 +65</option>
                <option value="+82">🇰🇷 +82</option>
                <option value="+852">🇭🇰 +852</option>
                <option value="+886">🇹🇼 +886</option>
              </select>
              
              <input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="604 618 9413"
                required
                autoComplete="tel-national"
                inputMode="numeric"
                className="flex-1 px-4 py-3.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose focus:border-transparent text-base touch-manipulation min-h-[44px]"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter your phone number without the country code
            </p>
          </div>

          {/* SMS Consent Notice */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              By providing your phone number and completing signup, you agree to receive weekly reminder text messages for your reflection circle. You can opt-out at any time by contacting us or replying STOP to any message.
            </p>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rose text-white py-3.5 sm:py-3 px-6 rounded-lg hover:bg-rose-dark active:bg-rose-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base sm:text-lg transition-colors touch-manipulation min-h-[44px] flex items-center justify-center"
          >
            {loading ? 'Sending Code...' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  )
}
