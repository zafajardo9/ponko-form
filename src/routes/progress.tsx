import { createFileRoute } from '@tanstack/react-router'
import { BuildProgressPage } from '../components/progress/BuildProgressPage'

export const Route = createFileRoute('/progress')({
  component: BuildProgressPage,
})
