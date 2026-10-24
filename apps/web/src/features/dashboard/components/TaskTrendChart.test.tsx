import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskTrendChart } from './TaskTrendChart';

describe('TaskTrendChart', () => {
  it('renders without error with empty data', () => {
    render(<TaskTrendChart data={[]} />);
    expect(screen.getByLabelText('Biểu đồ xu hướng hoàn thành công việc')).toBeInTheDocument();
  });

  it('aggregates 7-day range with 7 daily points and DD-MM format', () => {
    const rawData = [
      { date: '2026-10-13', created: 5, completed: 3 },
      { date: '2026-10-12', created: 2, completed: 4 },
    ];
    render(<TaskTrendChart data={rawData} range="7d" />);
    expect(screen.getByText('Hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Được tạo mới')).toBeInTheDocument();
  });

  it('aggregates 30-day range into 4 weekly points', () => {
    const rawData = [
      { date: '2026-10-13', created: 10, completed: 8 },
      { date: '2026-10-05', created: 4, completed: 2 },
    ];
    render(<TaskTrendChart data={rawData} range="30d" />);
    expect(screen.getByLabelText('Biểu đồ xu hướng hoàn thành công việc')).toBeInTheDocument();
  });

  it('aggregates quarter range into 6 half-month points', () => {
    const rawData = [
      { date: '2026-10-10', created: 12, completed: 6 },
      { date: '2026-09-20', created: 7, completed: 5 },
    ];
    render(<TaskTrendChart data={rawData} range="quarter" />);
    expect(screen.getByLabelText('Biểu đồ xu hướng hoàn thành công việc')).toBeInTheDocument();
  });
});

