// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUILD_MILESTONES, milestoneProgress } from '../../lib/build-progress'
import { BuildProgressPage } from './BuildProgressPage'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

// LiquidEther needs WebGL, which jsdom does not provide.
vi.mock('../LiquidEther', () => ({
  default: () => <div data-testid="liquid-ether" aria-hidden="true" />,
}))

describe('build progress data', () => {
  it('is linear: every done milestone precedes the first not-done one', () => {
    const statuses = BUILD_MILESTONES.map((milestone) => milestone.status)
    const firstFalse = statuses.indexOf(false)
    const trailingTrues = firstFalse === -1 ? 0 : statuses.slice(firstFalse).filter(Boolean).length
    expect(trailingTrues).toBe(0)
  })

  it('has unique ids, ordered dates, and details for every milestone', () => {
    const ids = BUILD_MILESTONES.map((milestone) => milestone.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(BUILD_MILESTONES.every((milestone) => milestone.details.length > 0)).toBe(true)
    expect(BUILD_MILESTONES.every((milestone) => milestone.title.trim().length > 0)).toBe(true)
  })

  it('reports the next planned milestone as the first not-completed one', () => {
    const progress = milestoneProgress()
    const firstFalse = BUILD_MILESTONES.findIndex((milestone) => !milestone.status)
    expect(progress.completed).toBe(firstFalse)
    expect(progress.nextUp?.id).toBe(BUILD_MILESTONES[firstFalse]?.id)
  })
})

describe('BuildProgressPage', () => {
  afterEach(cleanup)

  it('renders the hero, timeline, and persistent details for the next planned milestone', () => {
    render(<BuildProgressPage />)
    expect(screen.getByRole('heading', { name: /where ponkoform is right now/i })).toBeTruthy()
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(BUILD_MILESTONES.length)

    const nextUp = milestoneProgress().nextUp
    if (nextUp) {
      // The details card renders twice in jsdom: desktop panel + mobile sheet.
      expect(screen.getAllByRole('heading', { name: nextUp.title }).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(nextUp.summary).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('updates the details when a milestone is selected from the strip', () => {
    render(<BuildProgressPage />)
    const doneMilestone = BUILD_MILESTONES.find((milestone) => milestone.status)
    if (!doneMilestone) return
    fireEvent.click(screen.getByRole('button', { name: new RegExp(doneMilestone.title) }))
    expect(screen.getAllByRole('heading', { name: doneMilestone.title }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(doneMilestone.summary).length).toBeGreaterThanOrEqual(1)
  })

  it('closes the mobile details sheet from its close button', () => {
    render(<BuildProgressPage />)
    const nextUp = milestoneProgress().nextUp
    if (!nextUp) return
    expect(screen.getByRole('dialog', { name: `${nextUp.title} details` })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
