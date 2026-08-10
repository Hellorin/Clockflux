import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CookieConsentBanner from './CookieConsentBanner'

describe('CookieConsentBanner', () => {
  it('renders the disclaimer and both choices', () => {
    render(<CookieConsentBanner onAccept={() => {}} onRefuse={() => {}} />)
    expect(screen.getByRole('region', { name: 'Cookie preferences' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refuse' })).toBeInTheDocument()
  })

  it('calls onAccept when Accept is clicked', () => {
    const onAccept = vi.fn()
    render(<CookieConsentBanner onAccept={onAccept} onRefuse={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('calls onRefuse when Refuse is clicked', () => {
    const onRefuse = vi.fn()
    render(<CookieConsentBanner onAccept={() => {}} onRefuse={onRefuse} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refuse' }))
    expect(onRefuse).toHaveBeenCalledTimes(1)
  })

  it('links to the full privacy notice', () => {
    render(<CookieConsentBanner onAccept={() => {}} onRefuse={() => {}} />)
    expect(screen.getByRole('link', { name: 'Read more' })).toHaveAttribute('href', '#privacy')
  })
})
