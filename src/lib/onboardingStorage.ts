const ONBOARDING_KEY = 'planos_onboarding_done'

export function cacheOnboardingDone(userId: string): void {
  localStorage.setItem(ONBOARDING_KEY, userId)
}

export function isOnboardingCached(userId: string): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === userId
}

export function clearOnboardingCache(): void {
  localStorage.removeItem(ONBOARDING_KEY)
}
