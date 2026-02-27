import type { TournamentLiveView } from '../models/tournament-model/helpers';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class LiveComputationCache {
  private readonly liveViewCache = new Map<string, CacheEntry<TournamentLiveView>>();

  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 3000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public async getOrLoadLiveView(
    tournamentId: string,
    loader: () => Promise<TournamentLiveView | undefined>,
    ttlMs?: number
  ): Promise<TournamentLiveView | undefined> {
    const now = Date.now();
    const existing = this.liveViewCache.get(tournamentId);

    if (existing && existing.expiresAt > now) {
      return existing.value;
    }

    if (existing) {
      this.liveViewCache.delete(tournamentId);
    }

    const loaded = await loader();
    if (!loaded) {
      return undefined;
    }

    this.liveViewCache.set(tournamentId, {
      value: loaded,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
    });

    return loaded;
  }

  public invalidateTournament(tournamentId: string): void {
    this.liveViewCache.delete(tournamentId);
  }
}

export const liveComputationCache = new LiveComputationCache();
