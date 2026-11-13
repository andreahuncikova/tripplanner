import type { TripState } from '@shared/types'
import type { TripPlan } from '../../../socket/useTripPlan'

// What every planning step gets from PlanSection
export interface StepProps {
  plan: TripPlan
  state: TripState
  // The logged-in user's id
  me: string
  isOrganiser: boolean
  // The organiser's name, e.g. for "Mia confirms the winner"
  organiser: string
}
