import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useTournamentListGrouping from '../../../../src/components/tournament-list/use-tournament-list-grouping';

const t = (key: string) => key;

const baseTournaments = [
  { id: 'draft', name: 'Draft', format: 'X01', totalParticipants: 8, status: 'DRAFT' },
  { id: 'open', name: 'Open', format: 'X01', totalParticipants: 8, status: 'OPEN' },
  { id: 'signature', name: 'Signature', format: 'X01', totalParticipants: 8, status: 'SIGNATURE' },
  { id: 'live', name: 'Live', format: 'X01', totalParticipants: 8, status: 'IN_PROGRESS' },
];

describe('useTournamentListGrouping', () => {
  beforeEach(() => {
    globalThis.window?.history.pushState({}, '', '/');
  });

  it('includes registered signature tournaments in open filter for players', () => {
    globalThis.window?.history.pushState({}, '', '/?status=OPEN');
    const { result } = renderHook(() => useTournamentListGrouping({
      t,
      tournaments: baseTournaments,
      isAdmin: false,
      userRegistrations: new Set(['signature']),
    }));

    expect(result.current.groupedTournaments).toHaveLength(1);
    const items = result.current.groupedTournaments[0].items.map((item) => item.id);
    expect(items).toEqual(['open', 'signature']);
  });

  it('filters draft tournaments for non-admins', () => {
    globalThis.window?.history.pushState({}, '', '/?status=DRAFT');
    const { result } = renderHook(() => useTournamentListGrouping({
      t,
      tournaments: baseTournaments,
      isAdmin: false,
      userRegistrations: new Set(),
    }));

    expect(result.current.groupedTournaments).toHaveLength(0);
  });

  it('returns all groups for admins when no filter is set', () => {
    const { result } = renderHook(() => useTournamentListGrouping({
      t,
      tournaments: baseTournaments,
      isAdmin: true,
      userRegistrations: new Set(),
    }));

    const statuses = result.current.groupedTournaments.map((group) => group.status);
    expect(statuses).toEqual(['DRAFT', 'OPEN', 'SIGNATURE', 'LIVE', 'FINISHED']);
  });
});
