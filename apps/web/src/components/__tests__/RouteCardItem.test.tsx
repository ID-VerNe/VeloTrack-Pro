import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RouteCardItem from '../routes/RouteCardItem';
import { CURATED_ROUTES } from '../../data/curatedRoutes';

describe('RouteCardItem', () => {
  const sampleRoute = CURATED_ROUTES[0];

  it('renders route details with badges and metrics', () => {
    const onSelect = vi.fn();
    render(
      <RouteCardItem
        route={sampleRoute}
        isSelected={false}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText(sampleRoute.name)).toBeInTheDocument();
    expect(screen.getByText(`${sampleRoute.distanceKm} km`)).toBeInTheDocument();
    expect(screen.getByText(`爬升 ${sampleRoute.ascentM}m`)).toBeInTheDocument();
  });

  it('triggers onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(
      <RouteCardItem
        route={sampleRoute}
        isSelected={true}
        onSelect={onSelect}
      />
    );

    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledWith(sampleRoute);
  });
});
