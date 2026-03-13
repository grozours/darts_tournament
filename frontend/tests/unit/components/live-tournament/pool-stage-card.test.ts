import { describe, expect, it } from 'vitest';
import { formatLeaderboardPlayerName, getSkillStarsByLevel } from '../../../../src/components/live-tournament/pool-stage-card';

describe('pool-stage-card leaderboard skill stars', () => {
  it('maps skill levels to star strings', () => {
    expect(getSkillStarsByLevel('BEGINNER')).toBe('★');
    expect(getSkillStarsByLevel('INTERMEDIATE')).toBe('★★');
    expect(getSkillStarsByLevel('EXPERT')).toBe('★★★');
    expect(getSkillStarsByLevel('UNKNOWN')).toBe('');
  });

  it('shows stars only for admins outside screen mode', () => {
    expect(formatLeaderboardPlayerName('Player One', {
      isAdmin: true,
      screenMode: false,
      skillLevel: 'INTERMEDIATE',
    })).toBe('Player One ★★');

    expect(formatLeaderboardPlayerName('Player One', {
      isAdmin: true,
      screenMode: true,
      skillLevel: 'INTERMEDIATE',
    })).toBe('Player One');

    expect(formatLeaderboardPlayerName('Player One', {
      isAdmin: false,
      screenMode: false,
      skillLevel: 'INTERMEDIATE',
    })).toBe('Player One');
  });

  it('does not duplicate stars when already present in the display name', () => {
    expect(formatLeaderboardPlayerName('Player One ★★', {
      isAdmin: true,
      screenMode: false,
      skillLevel: 'INTERMEDIATE',
    })).toBe('Player One ★★');
  });

  it('supports group skill levels (doublettes/equipes) and still hides in screen mode', () => {
    expect(formatLeaderboardPlayerName('Team Alpha', {
      isAdmin: true,
      screenMode: false,
      skillLevel: 'EXPERT',
    })).toBe('Team Alpha ★★★');

    expect(formatLeaderboardPlayerName('Team Alpha', {
      isAdmin: true,
      screenMode: true,
      skillLevel: 'EXPERT',
    })).toBe('Team Alpha');
  });
});
