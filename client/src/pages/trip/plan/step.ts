import type { ReactNode } from 'react'
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
  // "Go back a step" for the organiser, shown in the dark step card (StepCard)
  back?: ReactNode
}
