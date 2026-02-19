import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MatchTargetSelector from '../../../../src/components/live-tournament/match-target-selector';

const t = (key: string) => key;

describe('MatchTargetSelector', () => {
  it('renders targets and starts match when enabled', () => {
    const onStartMatch = vi.fn();

    render(
      <MatchTargetSelector
        t={t}
        matchTournamentId="t1"
        matchId="m1"
        matchKey="t1:m1"
        availableTargets={[{ id: 'target-1', targetNumber: 1 }]}
        selectedTargetNumber="1"
        selectedTargetId="target-1"
        updatingMatchId={undefined}
        getTargetLabel={(target) => `Target ${target.targetNumber}`}
        onTargetSelectionChange={vi.fn()}
        onStartMatch={onStartMatch}
        containerClassName="custom"
      />
    );

    fireEvent.click(screen.getByText('live.startMatch'));
    expect(onStartMatch).toHaveBeenCalledWith('t1', 'm1', 'target-1');
  });

  it('disables start when selection is missing or updating', () => {
    render(
      <MatchTargetSelector
        t={t}
        matchTournamentId="t1"
        matchId="m1"
        matchKey="t1:m1"
        availableTargets={[]}
        selectedTargetNumber=""
        selectedTargetId={undefined}
        updatingMatchId="t1:m1"
        getTargetLabel={() => ''}
        onTargetSelectionChange={vi.fn()}
        onStartMatch={vi.fn()}
      />
    );

    const button = screen.getByText('live.startingMatch');
    expect(button).toBeDisabled();
  });
});
