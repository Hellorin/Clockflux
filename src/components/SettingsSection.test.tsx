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
})
