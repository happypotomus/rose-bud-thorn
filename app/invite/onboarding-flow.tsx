'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WelcomeStep } from './welcome-step'
import { PhoneVerificationStep } from './phone-verification-step'
import { CreateCircleStep } from './create-circle-step'

type Step = 'welcome' | 'phone' | 'create-circle' | 'complete'

export function OnboardingFlow() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [userData, setUserData] = useState<{
    userId: string
    firstName: string
    phone: string
  } | null>(null)
  const [createdCircleId, setCreatedCircleId] = useState<string | null>(null)

  const handleWelcomeContinue = () => {
    setCurrentStep('phone')
  }

  const handlePhoneVerified = (userId: string, firstName: string, phone: string) => {
    setUserData({ userId, firstName, phone })
    setCurrentStep('create-circle')
  }

  const handleCircleCreated = (circleId: string) => {
    setCreatedCircleId(circleId)
    setCurrentStep('complete')
    // Redirect to home with the new circle
    router.push(`/home?circleId=${circleId}`)
  }

  switch (currentStep) {
    case 'welcome':
      return <WelcomeStep onContinue={handleWelcomeContinue} />
    case 'phone':
      return <PhoneVerificationStep onVerified={handlePhoneVerified} />
    case 'create-circle':
      return userData ? (
        <CreateCircleStep userId={userData.userId} onCircleCreated={handleCircleCreated} />
      ) : null
    case 'complete':
      // This should redirect, but show loading state just in case
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-600">Redirecting...</p>
        </div>
      )
    default:
      return null
  }
}
