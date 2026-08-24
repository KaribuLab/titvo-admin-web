import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RawKeyModal } from '../../src/components/RawKeyModal'

describe('RawKeyModal', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('shows the raw key value exactly once, as plain text in the dialog', () => {
    render(<RawKeyModal label="CI pipeline" apiKey="tvok-abc123xyz" onDismiss={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('tvok-abc123xyz')).toBeInTheDocument()
  })

  it('disables the Done button until the "I\'ve copied this key" checkbox is checked (show-once dismiss guard)', async () => {
    const onDismiss = vi.fn()
    render(<RawKeyModal label="CI pipeline" apiKey="tvok-abc123xyz" onDismiss={onDismiss} />)

    const doneButton = screen.getByRole('button', { name: /done/i })
    expect(doneButton).toBeDisabled()

    await userEvent.click(doneButton)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('enables Done only after the acknowledgment checkbox is explicitly checked, and calls onDismiss on click', async () => {
    const onDismiss = vi.fn()
    render(<RawKeyModal label="CI pipeline" apiKey="tvok-abc123xyz" onDismiss={onDismiss} />)

    await userEvent.click(screen.getByLabelText(/i've copied this key/i))
    const doneButton = screen.getByRole('button', { name: /done/i })
    expect(doneButton).toBeEnabled()

    await userEvent.click(doneButton)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('copies the raw key to the clipboard when Copy is clicked', async () => {
    render(<RawKeyModal label="CI pipeline" apiKey="tvok-abc123xyz" onDismiss={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /copy key/i }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('tvok-abc123xyz')
    expect(await screen.findByRole('button', { name: /^copied$/i })).toBeInTheDocument()
  })

  it('renders no close icon or any other unguarded dismiss control besides the gated Done button', () => {
    render(<RawKeyModal label="CI pipeline" apiKey="tvok-abc123xyz" onDismiss={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /close|dismiss|×/i })).not.toBeInTheDocument()
  })

  it('ignores Escape and an outside click — Done is the only exit (shadcn Dialog defaults to allowing all three, this must not)', async () => {
    const onDismiss = vi.fn()
    render(<RawKeyModal label="CI pipeline" apiKey="tvok-abc123xyz" onDismiss={onDismiss} />)

    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onDismiss).not.toHaveBeenCalled()

    // Radix's dismissable-layer listens for `pointerdown` outside the
    // content to decide whether to fire `onPointerDownOutside` — dispatch
    // it directly (bypassing `userEvent`'s pointer-events guard, since
    // Radix itself sets `pointer-events: none` on the body while the
    // dialog is open, which is a second, independent lock against
    // backdrop dismissal on top of the explicit `preventDefault()` below).
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('never leaves the raw key value in the DOM once the caller unmounts the modal after dismissal', async () => {
    function Wrapper (): React.ReactElement {
      const [open, setOpen] = React.useState(true)
      return open
        ? <RawKeyModal label="CI pipeline" apiKey="tvok-abc123xyz" onDismiss={() => setOpen(false)} />
        : <div>dismissed</div>
    }

    render(<Wrapper />)
    expect(screen.getByText('tvok-abc123xyz')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText(/i've copied this key/i))
    await userEvent.click(screen.getByRole('button', { name: /done/i }))

    expect(await screen.findByText('dismissed')).toBeInTheDocument()
    expect(screen.queryByText('tvok-abc123xyz')).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('tvok-abc123xyz')
  })
})
