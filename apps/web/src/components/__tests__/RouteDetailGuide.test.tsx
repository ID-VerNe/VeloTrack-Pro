import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RouteDetailGuide from '../routes/RouteDetailGuide';
import { CURATED_ROUTES } from '../../data/curatedRoutes';

vi.mock('../routes/RouteMapPreview', () => ({
  default: () => <div data-testid="mock-route-map-preview" />,
}));

describe('RouteDetailGuide', () => {
  const sampleRoute = CURATED_ROUTES[0];

  it('renders route details, metric boxes and recommendations', () => {
    const onAskCoach = vi.fn();
    render(<RouteDetailGuide route={sampleRoute} onAskCoach={onAskCoach} />);

    expect(screen.getByTestId('mock-route-map-preview')).toBeInTheDocument();
    expect(screen.getByText(sampleRoute.name)).toBeInTheDocument();
    expect(screen.getByText(sampleRoute.description)).toBeInTheDocument();
    expect(screen.getByText(sampleRoute.distanceKm)).toBeInTheDocument();
    expect(screen.getByText(sampleRoute.ascentM)).toBeInTheDocument();
    expect(screen.getByText(sampleRoute.suitableBike)).toBeInTheDocument();
    expect(screen.getByText('齿比与踏频建议')).toBeInTheDocument();
    expect(screen.getByText(sampleRoute.recommendedGear)).toBeInTheDocument();
    expect(screen.getByText('膝关节保护提示')).toBeInTheDocument();
    expect(screen.getByText(sampleRoute.kneeSafetyAdvice)).toBeInTheDocument();
  });

  it('triggers onAskCoach callback when coach simulation button clicked', () => {
    const onAskCoach = vi.fn();
    render(<RouteDetailGuide route={sampleRoute} onAskCoach={onAskCoach} />);

    const askBtn = screen.getByText('推演此路线齿比与配速');
    fireEvent.click(askBtn);
    expect(onAskCoach).toHaveBeenCalledTimes(1);
  });
});
