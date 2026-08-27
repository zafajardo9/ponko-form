// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

const { mockPopup, savePopupMock, setPopupStatusMock } = vi.hoisted(() => {
  const mockPopup = {
    id: 7,
    profileId: 1,
    title: 'Newsletter popup',
    status: 'draft',
    publicId: 'popupsmokepub',
    width: 420,
    height: 380,
    placement: 'center',
    trigger: { type: 'on-load', delayMs: 0 },
    frequency: 'once-per-session',
    style: {
      fontFamily: 'sans',
      backgroundColor: '#ffffff',
      overlayColor: '#141413',
      overlayOpacity: 0.5,
      animation: 'fade',
      closable: true,
      closeOnOverlayClick: true,
      borderRadius: 16,
    },
    elements: [
      {
        id: 'el-heading',
        type: 'heading',
        x: 32,
        y: 44,
        width: 356,
        height: 62,
        zIndex: 1,
        opacity: 1,
        rotation: 0,
        level: 2,
        text: 'Get 10% off your first order',
        color: '#141413',
        fontSize: 30,
        fontWeight: 'semibold',
        align: 'center',
      },
      {
        id: 'el-button',
        type: 'button',
        x: 110,
        y: 232,
        width: 200,
        height: 48,
        zIndex: 3,
        opacity: 1,
        rotation: 0,
        label: 'Join the newsletter',
        bgColor: '#cc785c',
        textColor: '#ffffff',
        radius: 10,
        link: '',
        openInNewTab: false,
        fontWeight: 'medium',
        fontSize: 15,
      },
    ],
    viewCount: 3,
    clickCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return {
    mockPopup,
    savePopupMock: vi.fn().mockResolvedValue({ ...mockPopup }),
    setPopupStatusMock: vi.fn().mockResolvedValue({ success: true }),
  }
})

vi.mock('@/lib/server-fns/popups', () => ({
  getPopup: vi.fn().mockResolvedValue(mockPopup),
  savePopup: (...args: unknown[]) => savePopupMock(...(args as [])),
  setPopupStatus: (...args: unknown[]) => setPopupStatusMock(...(args as [])),
  deletePopup: vi.fn(),
}))

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), show: vi.fn(), dismiss: vi.fn() }),
}))

vi.mock('../auth/UserMenu', () => ({
  UserMenu: () => <button type="button" aria-label="Open account menu">T</button>,
}))

import { PopupBuilderWorkspace } from './PopupBuilderWorkspace'

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PopupBuilderWorkspace popupId={7} />
    </QueryClientProvider>,
  )
}

afterEach(cleanup)

describe('PopupBuilderWorkspace', () => {
  it('renders the three-pane editor with the canvas showing the saved layout', async () => {
    renderWorkspace()

    const palette = await screen.findByLabelText('Elements')
    expect(within(palette).getByText('Heading')).toBeTruthy()
    expect(within(palette).getByText('Button')).toBeTruthy()

    await waitFor(() => expect(screen.getByText('Get 10% off your first order')).toBeTruthy())
    // The builder remains WYSIWYG even before a destination is connected.
    expect(screen.getByRole('button', { name: 'Join the newsletter' })).toBeTruthy()

    expect(screen.getByText('When it appears')).toBeTruthy()
    expect(screen.getByText('On page load')).toBeTruthy()
    expect(screen.getByText('Exit intent')).toBeTruthy()
    expect(screen.getByText('Scroll depth')).toBeTruthy()
    expect(screen.getByText('Display schedule')).toBeTruthy()
    expect(screen.getByText('Daily hours')).toBeTruthy()
    expect(screen.getByLabelText('Starts')).toBeTruthy()
    expect(screen.getByLabelText('Ends')).toBeTruthy()

    expect(screen.getByRole('button', { name: /preview/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Embed' })).toBeTruthy()
  })

  it('adds an element from the palette and shows its contextual settings', async () => {
    renderWorkspace()
    await screen.findByText('When it appears')

    const palette = screen.getByLabelText('Elements')
    fireEvent.click(within(palette).getByRole('button', { name: /image/i }))

    await waitFor(() => expect(screen.getByText('Image URL')).toBeTruthy())
    expect(screen.getByText('image element')).toBeTruthy()
  })

  it('pins an image to the full canvas width and keeps it pinned after resizing', async () => {
    renderWorkspace()
    await screen.findByText('When it appears')

    fireEvent.click(within(screen.getByLabelText('Elements')).getByRole('button', { name: /image/i }))
    const imageOverlay = await screen.findByLabelText('image element')
    fireEvent.click(screen.getByLabelText(/Full canvas width/))

    await waitFor(() => {
      expect(imageOverlay.style.left).toBe('0px')
      expect(imageOverlay.style.width).toBe('420px')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Popup' }))
    const canvasWidth = screen.getByLabelText('Width (px)') as HTMLInputElement
    fireEvent.change(canvasWidth, { target: { value: '1' } })
    expect(canvasWidth.value).toBe('1')
    expect(imageOverlay.style.width).toBe('420px')
    fireEvent.change(canvasWidth, { target: { value: '1920' } })
    fireEvent.blur(canvasWidth)

    await waitFor(() => expect(imageOverlay.style.width).toBe('1920px'))
  })

  it('keeps element dimensions as drafts until the exact value is committed', async () => {
    renderWorkspace()
    await screen.findByText('When it appears')

    fireEvent.click(within(screen.getByLabelText('Elements')).getByRole('button', { name: /image/i }))
    const imageOverlay = await screen.findByLabelText('image element')
    const elementWidth = screen.getByLabelText('W') as HTMLInputElement

    fireEvent.change(elementWidth, { target: { value: '1' } })
    expect(elementWidth.value).toBe('1')
    expect(imageOverlay.style.width).toBe('200px')

    fireEvent.change(elementWidth, { target: { value: '333' } })
    fireEvent.blur(elementWidth)
    await waitFor(() => expect(imageOverlay.style.width).toBe('333px'))
  })

  it('switches the trigger and keeps the editor usable', async () => {
    renderWorkspace()
    await screen.findByText('When it appears')

    fireEvent.click(screen.getByText('Exit intent'))
    await waitFor(() =>
      expect(screen.getByText(/moves toward the tab/i)).toBeTruthy(),
    )
  })

  it('offers a complete visual editor for button elements', async () => {
    renderWorkspace()
    await screen.findByText('When it appears')

    const buttonOverlay = screen.getByLabelText('button element')
    buttonOverlay.setPointerCapture = vi.fn()
    fireEvent.pointerDown(buttonOverlay, { clientX: 120, clientY: 250, pointerId: 1 })
    fireEvent.pointerUp(buttonOverlay, { pointerId: 1 })

    await waitFor(() => expect(screen.getByText('Style starter')).toBeTruthy())
    expect(screen.getByLabelText('Button style starters')).toBeTruthy()
    expect(screen.getByText('Color & edge')).toBeTruthy()
    expect(screen.getByLabelText('Button horizontal alignment')).toBeTruthy()
    expect(screen.getByLabelText('Button shadow')).toBeTruthy()
    expect(screen.getByLabelText('Button hover effect')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Ink/ }))
    expect(screen.getByRole('button', { name: /Ink/ }).getAttribute('aria-pressed')).toBe('true')
  })
})
