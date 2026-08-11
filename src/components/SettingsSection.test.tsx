import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsSection from './SettingsSection'

describe('SettingsSection', () => {
  it('is collapsed by default and expands/collapses on header click', () => {
    render(
      <SettingsSection title="Holiday">
        <p>Section content</p>
      </SettingsSection>
    )
    expect(screen.queryByText('Section content')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Holiday'))
    expect(screen.getByText('Section content')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Holiday'))
    expect(screen.queryByText('Section content')).not.toBeInTheDocument()
  })

  it('starts expanded when defaultOpen is true', () => {
    render(
      <SettingsSection title="Holiday" defaultOpen>
        <p>Section content</p>
      </SettingsSection>
    )
    expect(screen.getByText('Section content')).toBeInTheDocument()
  })

  it('is always expanded and has no toggle when collapsible is false', () => {
    render(
      <SettingsSection title="Sync" collapsible={false}>
        <p>Section content</p>
      </SettingsSection>
    )
    expect(screen.getByText('Section content')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Sync' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Sync'))
    expect(screen.getByText('Section content')).toBeInTheDocument()
  })
})
