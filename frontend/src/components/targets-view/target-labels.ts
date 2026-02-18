import type { LiveViewMatch, LiveViewTarget, Translator } from './types';

type PlayerIdentity = {
  id?: string;
  firstName: string;
  lastName: string;
  teamName?: string;
};

type PlayerLabel = {
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

export const getPlayerLabel = (player?: PlayerLabel) => {
  if (!player) return '';
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

export const getMatchPlayers = (match: LiveViewMatch) =>
  (match.playerMatches ?? [])
    .map((playerMatch) => getPlayerLabel(playerMatch.player))
    .filter(Boolean);
