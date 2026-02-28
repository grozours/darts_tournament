import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TargetsQueuePanel from '../../../../src/components/targets-view/targets-queue-panel';

const t = (key: string) => key;

describe('targets-queue-panel', () => {
  it('renders empty state when queue is empty', () => {
    render(<TargetsQueuePanel t={t} queueItems={[]} queuePreview={[]} />);

    expect(screen.getByRole('heading', { name: 'live.queue.title' })).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('live.queue.empty')).toBeInTheDocument();
  });

  it('renders pool and bracket queue cards with optional target and players', () => {
    render(
      <TargetsQueuePanel
        t={t}
        queueItems={[
          {
            source: 'pool',
            tournamentId: 't1',
            tournamentName: 'Cup',
            matchId: 'm1',
            matchNumber: 2,
            roundNumber: 1,
            status: 'SCHEDULED',
            stageNumber: 1,
            stageName: 'Stage A',
            poolNumber: 3,
            players: ['Alice', 'Bob'],
            targetCode: 'target12',
          },
          {
            source: 'bracket',
            tournamentId: 't2',
            tournamentName: 'League',
            matchId: 'm2',
            matchNumber: 4,
            roundNumber: 2,
            status: 'IN_PROGRESS',
            bracketName: 'Main bracket',
            players: [],
          },
          {
            source: 'pool',
            tournamentId: 't3',
            tournamentName: 'Open',
            matchId: 'm3',
            matchNumber: 1,
            roundNumber: 1,
            status: 'SCHEDULED',
            stageNumber: 2,
            stageName: 'Stage B',
            poolNumber: 1,
            players: ['Solo'],
            targetNumber: 8,
          },
        ] as never}
        queuePreview={[
          {
            source: 'pool',
            tournamentId: 't1',
            tournamentName: 'Cup',
            matchId: 'm1',
            matchNumber: 2,
            roundNumber: 1,
            status: 'SCHEDULED',
            stageNumber: 1,
            stageName: 'Stage A',
            poolNumber: 3,
            players: ['Alice', 'Bob'],
            targetCode: 'target12',
          },
          {
            source: 'bracket',
            tournamentId: 't2',
            tournamentName: 'League',
            matchId: 'm2',
            matchNumber: 4,
            roundNumber: 2,
            status: 'IN_PROGRESS',
            bracketName: 'Main bracket',
            players: [],
          },
          {
            source: 'pool',
            tournamentId: 't3',
            tournamentName: 'Open',
            matchId: 'm3',
            matchNumber: 1,
            roundNumber: 1,
            status: 'SCHEDULED',
            stageNumber: 2,
            stageName: 'Stage B',
            poolNumber: 1,
            players: ['Solo'],
            targetNumber: 8,
          },
        ] as never}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('live.queue.stageLabel 1: Stage A · live.queue.poolLabel 3')).toBeInTheDocument();
    expect(screen.getByText('targets.bracketLabel Main bracket')).toBeInTheDocument();
    expect(screen.getByText('live.queue.targetLabel targets.target 12')).toBeInTheDocument();
    expect(screen.getByText('live.queue.targetLabel #8')).toBeInTheDocument();
    expect(screen.getByText('Alice · Bob')).toBeInTheDocument();
    expect(screen.getByText('Solo')).toBeInTheDocument();
  });
});
