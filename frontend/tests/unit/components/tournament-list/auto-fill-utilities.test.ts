import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildAutoFillRegistrations } from '../../../../src/components/tournament-list/auto-fill-utilities';

describe('buildAutoFillRegistrations', () => {
  const getRandomValuesSpy = vi.spyOn(globalThis.crypto, 'getRandomValues');

  beforeEach(() => {
    getRandomValuesSpy.mockImplementation((buffer: Uint32Array) => {
      buffer[0] = 1;
      return buffer;
    });
  });

  afterEach(() => {
    getRandomValuesSpy.mockRestore();
  });

  it('returns an error when there are not enough unique surnames', () => {
    const result = buildAutoFillRegistrations({
      remainingSlots: 4,
      players: [],
      isTeamFormat: false,
      sampleFirstNames: ['Alice'],
      sampleLastNames: ['Smith'],
      lastNameModifiers: ['A'],
      sampleSurnames: ['Eagle'],
      sampleTeams: ['Team A'],
      teamModifiers: ['Blue'],
    });

    expect(result.error).toBe('Not enough unique surnames to fill remaining slots.');
    expect(result.registrations).toHaveLength(0);
  });

  it('returns an error when team format has not enough unique teams', () => {
    const result = buildAutoFillRegistrations({
      remainingSlots: 4,
      players: [],
      isTeamFormat: true,
      sampleFirstNames: ['Alice', 'Bob'],
      sampleLastNames: ['Smith', 'Jones'],
      lastNameModifiers: ['A'],
      sampleSurnames: ['Eagle', 'Falcon'],
      sampleTeams: ['Team A'],
      teamModifiers: ['Blue'],
    });

    expect(result.error).toBe('Not enough unique team names to fill remaining slots.');
    expect(result.registrations).toHaveLength(0);
  });

  it('builds registrations for remaining slots', () => {
    const result = buildAutoFillRegistrations({
      remainingSlots: 2,
      players: [],
      isTeamFormat: false,
      sampleFirstNames: ['Alice', 'Bob'],
      sampleLastNames: ['Smith', 'Jones'],
      lastNameModifiers: ['A', 'B'],
      sampleSurnames: ['Eagle', 'Falcon', 'Wolf'],
      sampleTeams: ['Team A', 'Team B', 'Team C'],
      teamModifiers: ['Blue', 'Red'],
    });

    expect(result.error).toBeUndefined();
    expect(result.registrations).toHaveLength(2);
    expect(result.registrations[0]?.email).toContain('@example.com');
    expect(result.registrations[0]?.firstName).toBeTruthy();
    expect(result.registrations[0]?.lastName).toBeTruthy();
  });

  it('builds team registrations with unique team names', () => {
    const result = buildAutoFillRegistrations({
      remainingSlots: 1,
      players: [],
      isTeamFormat: true,
      sampleFirstNames: ['Alice'],
      sampleLastNames: ['Smith'],
      lastNameModifiers: [],
      sampleSurnames: ['Eagle'],
      sampleTeams: ['Team A'],
      teamModifiers: [],
    });

    expect(result.error).toBeUndefined();
    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0]?.teamName).toBe('Team A');
  });

  it('returns an error when unique names are exhausted by existing players', () => {
    const result = buildAutoFillRegistrations({
      remainingSlots: 2,
      players: [{ name: 'Alice Smith' } as never],
      isTeamFormat: false,
      sampleFirstNames: ['Alice'],
      sampleLastNames: ['Smith'],
      lastNameModifiers: [],
      sampleSurnames: ['Eagle', 'Falcon'],
      sampleTeams: ['Team A', 'Team B'],
      teamModifiers: [],
    });

    expect(result.registrations).toHaveLength(0);
    expect(result.error).toBe('Not enough unique names to fill remaining slots.');
  });
});
