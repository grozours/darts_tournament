import { describe, expect, it } from '@jest/globals';
import { TournamentFormat } from '../../../shared/src/types';
import { getPlayerCapacityFromSlots, getSlotMemberCount } from '../../src/services/tournament-service/slot-capacity';

describe('slot-capacity helpers', () => {
  it('returns expected member counts by format', () => {
    expect(getSlotMemberCount(TournamentFormat.SINGLE)).toBe(1);
    expect(getSlotMemberCount(TournamentFormat.DOUBLE)).toBe(2);
    expect(getSlotMemberCount(TournamentFormat.TEAM_4_PLAYER)).toBe(4);
  });

  it('computes player capacity from slot count and format', () => {
    expect(getPlayerCapacityFromSlots(8, TournamentFormat.SINGLE)).toBe(8);
    expect(getPlayerCapacityFromSlots(8, TournamentFormat.DOUBLE)).toBe(16);
    expect(getPlayerCapacityFromSlots(8, TournamentFormat.TEAM_4_PLAYER)).toBe(32);
  });
});
