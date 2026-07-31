import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import OvertimeChart from './OvertimeChart'

describe('OvertimeChart', () => {
  it('renders nothing with fewer than 2 data points', () => {
    const { container } = render(<OvertimeChart series={[{ weekKey: '2024-01-08', cumulative: 1 }]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing with an empty series', () => {
    const { container } = render(<OvertimeChart series={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders an svg with all-positive values (no zero-crossing)', () => {
    const series = [
      { weekKey: '2024-01-08', cumulative: 1 },
      { weekKey: '2024-01-15', cumulative: 3 },
      { weekKey: '2024-01-22', cumulative: 5 },
    ]
    const { container } = render(<OvertimeChart series={series} />)
    expect(container.querySelector('svg.overtime-chart')).not.toBeNull()
    expect(container.querySelectorAll('.overtime-chart__line--positive').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.overtime-chart__line--negative').length).toBe(0)
  })

  it('renders segments crossing zero and month labels across a month boundary', () => {
    const series = [
      { weekKey: '2024-01-29', cumulative: 2 },
      { weekKey: '2024-02-05', cumulative: -3 },
      { weekKey: '2024-02-12', cumulative: 1 },
    ]
    const { container } = render(<OvertimeChart series={series} />)
    expect(container.querySelectorAll('.overtime-chart__line--positive').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.overtime-chart__line--negative').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.overtime-chart__week-label').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.overtime-chart__zero-line')).not.toBeNull()
  })

  it('formats hour labels with minutes when present', () => {
    const series = [
      { weekKey: '2024-01-08', cumulative: 1.5 },
      { weekKey: '2024-01-15', cumulative: -2.25 },
    ]
    const { container } = render(<OvertimeChart series={series} />)
    const labels = Array.from(container.querySelectorAll('.overtime-chart__axis-label')).map(n => n.textContent)
    expect(labels.some(l => /h\d+m/.test(l))).toBe(true)
  })
})
