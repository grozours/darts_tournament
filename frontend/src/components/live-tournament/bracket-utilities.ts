import type { LiveViewBracket, LiveViewMatch, LiveViewMatchPlayer, Translator } from './types';

export type BracketMatchSlot = LiveViewMatch & { isPlaceholder?: boolean };

export type BracketTone = {
  card: string;
  row: string;
  accent: string;
  winner: string;
};

export const getBracketRoundLabel = (roundNumber: number, totalRounds: number, t: Translator) => {
  const distance = totalRounds - roundNumber;
  const labels: Record<number, string> = {
    0: t('live.round.final'),
    1: t('live.round.semiFinal'),
    2: t('live.round.quarterFinal'),
    3: t('live.round.roundOf16'),
  };
  return labels[distance] ?? `${t('live.queue.roundLabel')} ${roundNumber}`;
};

export const getBracketPlayerLabel = (
  playerMatch?: LiveViewMatchPlayer,
  getParticipantLabel?: (player: LiveViewMatchPlayer['player']) => string
) => {
  if (!playerMatch?.player) return 'TBD';
  if (getParticipantLabel) {
    return getParticipantLabel(playerMatch.player);
  }
  return `${playerMatch.player.firstName} ${playerMatch.player.lastName}`.trim();
};

const buildRoundMap = (matches: LiveViewMatch[]) => {
  const roundMap = new Map<number, LiveViewMatch[]>();
  for (const match of matches) {
    const round = match.roundNumber || 1;
    if (!roundMap.has(round)) {
      roundMap.set(round, []);
    }
    roundMap.get(round)?.push(match);
  }
  return roundMap;
};

const computeBracketSize = (bracket: LiveViewBracket, roundMap: Map<number, LiveViewMatch[]>) => {
  const entryCount = bracket.entries?.length ?? 0;
  const round1Count = roundMap.get(1)?.length ?? 0;
  const inferredSize = Math.max(entryCount, round1Count * 2, 2);
  return 2 ** Math.ceil(Math.log2(inferredSize));
};

const createRoundSlots = (bracketId: string, roundNumber: number, expectedMatches: number) => (
  Array.from({ length: expectedMatches }, (_, index) => ({
    id: `placeholder-${bracketId}-${roundNumber}-${index}`,
    matchNumber: index + 1,
    roundNumber,
    status: 'SCHEDULED',
    playerMatches: [],
    isPlaceholder: true,
  } as BracketMatchSlot))
);

const fillRoundSlots = (slots: BracketMatchSlot[], matches: LiveViewMatch[]) => {
  for (const match of matches) {
    const slotIndex = match.matchNumber - 1;
    if (slotIndex >= 0 && slotIndex < slots.length) {
      slots[slotIndex] = match as BracketMatchSlot;
    }
  }
  return slots;
};

export const buildBracketRounds = (bracket: LiveViewBracket) => {
  const matches = bracket.matches ?? [];
  const roundMap = buildRoundMap(matches);
  const bracketSize = computeBracketSize(bracket, roundMap);
  const inferredRounds = Math.max(1, Math.log2(bracketSize));
  const totalRounds = Math.max(bracket.totalRounds || 0, inferredRounds);

  const rounds: Array<{ roundNumber: number; matches: BracketMatchSlot[] }> = [];
  for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber += 1) {
    const expectedMatches = Math.max(1, Math.floor(bracketSize / (2 ** roundNumber)));
    const roundMatches = [...(roundMap.get(roundNumber) ?? [])]
      .toSorted((a, b) => a.matchNumber - b.matchNumber);
    const slots = createRoundSlots(bracket.id, roundNumber, expectedMatches);
    rounds.push({ roundNumber, matches: fillRoundSlots(slots, roundMatches) });
  }

  return rounds;
};

export const getBracketTone = (roundIndex: number, totalRounds: number): BracketTone => {
  if (roundIndex >= totalRounds - 1) {
    return {
      card: 'bg-slate-900/90 text-slate-100 border-slate-600',
      row: 'bg-slate-950/70 border-slate-700',
      accent: 'text-slate-300',
      winner: 'text-amber-300',
    };
  }
  if (roundIndex % 2 === 0) {
    return {
      card: 'bg-slate-900/80 text-slate-100 border-slate-700',
      row: 'bg-slate-950/70 border-slate-700',
      accent: 'text-slate-300',
      winner: 'text-emerald-300',
    };
  }
  return {
    card: 'bg-slate-900/85 text-slate-100 border-slate-600',
    row: 'bg-slate-950/70 border-slate-700',
    accent: 'text-slate-300',
    winner: 'text-emerald-300',
  };
};
