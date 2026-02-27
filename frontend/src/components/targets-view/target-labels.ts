import type { LiveViewMatch, LiveViewTarget, Translator } from './types';

type PlayerIdentity = {
  id?: string;
  firstName: string;
  lastName: string;
  teamName?: string;
};

type PlayerLabel = {
  id?: string;
  firstName: string;
  lastName: string;
  surname?: string;
  teamName?: string;
};

export const statusWeight = (status: string) => (status === 'IN_PROGRESS' ? 0 : 1);

export const getPlayerIdentity = (player?: PlayerIdentity) => {
  if (!player) return;
  if (player.id) return `id:${player.id}`;
  if (player.teamName) return `team:${player.teamName}`;
  return `name:${player.firstName} ${player.lastName}`.trim();
};

export const formatTargetLabel = (value: string, t: Translator) => {
  const match = /^target\s*(\d+)$/i.exec(value.trim());
  if (match) {
    return `${t('targets.target')} ${match[1]}`;
  }
  return value;
};

export const getTargetLabel = (target: LiveViewTarget, t: Translator) => {
  const base = target.targetCode || target.name || `#${target.targetNumber}`;
  return formatTargetLabel(base, t);
};

export const getPlayerLabel = (
  player?: PlayerLabel,
  groupNameByPlayerId?: Map<string, string>
) => {
  if (!player) return '';
  if (player.id) {
    const groupName = groupNameByPlayerId?.get(player.id);
    if (groupName) {
      return groupName;
    }
  }
  if (player.teamName) return player.teamName;
  if (player.surname) return player.surname;
  return `${player.firstName} ${player.lastName}`.trim();
};

export const getSurnameList = (players: string[]) =>
  players
    .map((name) => {
      const parts = name.trim().split(/\s+/);
      return parts.at(-1) ?? name;
    })
    .filter(Boolean)
    .join(' · ');

export const formatParticipantsLabel = (players: string[], fallback: string) => {
  const label = players.join(' · ').trim();
  return label || fallback;
};

export const getMatchStatusLabel = (status: string, t: Translator) => {
  const key = status.trim().toUpperCase();
  const labels: Record<string, string> = {
    SCHEDULED: t('status.match.scheduled'),
    IN_PROGRESS: t('status.match.in_progress'),
    COMPLETED: t('status.match.completed'),
    CANCELLED: t('status.match.cancelled'),
  };
  return labels[key] ?? status;
};

export const getMatchPlayers = (
  match: LiveViewMatch,
  groupNameByPlayerId?: Map<string, string>
) =>
  (match.playerMatches ?? [])
    .map((playerMatch) => getPlayerLabel(playerMatch.player, groupNameByPlayerId))
    .filter(Boolean);
