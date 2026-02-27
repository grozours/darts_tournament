import { TournamentFormat } from '../../../../shared/src/types';

export const getSlotMemberCount = (format: TournamentFormat): number => {
  if (format === TournamentFormat.DOUBLE) {
    return 2;
  }

  if (format === TournamentFormat.TEAM_4_PLAYER) {
    return 4;
  }

  return 1;
};

export const getPlayerCapacityFromSlots = (
  totalSlots: number,
  format: TournamentFormat
): number => totalSlots * getSlotMemberCount(format);
