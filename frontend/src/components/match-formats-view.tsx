import { useEffect, useState } from 'react';
import type { MatchFormatPresetSegment } from '@shared/types';
import { useI18n } from '../i18n';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import {
  createMatchFormatPreset,
  deleteMatchFormatPreset,
  fetchMatchFormatPresets,
  type MatchFormatPresetEntity,
  updateMatchFormatPreset,
} from '../services/tournament-service';
import {
  getSegmentGameLabel,
  setMatchFormatPresets,
} from '../utils/match-format-presets';

type SegmentDraft = {
  id: string;
  description: string;
};

type MatchFormatDraft = {
  id?: string;
  key: string;
  durationMinutes: number;
  segments: SegmentDraft[];
  isSystem: boolean;
};

const DEFAULT_SEGMENT_TARGET_COUNT = 1;

const defaultDraft = (): MatchFormatDraft => ({
  key: '',
  durationMinutes: 30,
  segments: [{ id: crypto.randomUUID(), description: '501 DO' }],
  isSystem: false,
});

const toEditableSegmentDescription = (segment: MatchFormatPresetSegment): string => {
  const gameLabel = getSegmentGameLabel(segment.game);
  if (segment.targetCount <= 1) {
    return gameLabel;
  }
  return `${gameLabel} - ${segment.targetCount} Tableaux`;
};

const toDraft = (preset: MatchFormatPresetEntity): MatchFormatDraft => ({
  id: preset.id,
  key: String(preset.key ?? '').trim(),
  durationMinutes: Number(preset.durationMinutes ?? 0),
  segments: Array.isArray(preset.segments)
    ? preset.segments.map((segment) => ({
      id: crypto.randomUUID(),
      description: toEditableSegmentDescription(segment),
    }))
    : [],
  isSystem: Boolean(preset.isSystem),
});

const MatchFormatsView = () => {
  const { t } = useI18n();
  const { isAdmin } = useAdminStatus();
  const { enabled: authEnabled, isAuthenticated, getAccessTokenSilently } = useOptionalAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [items, setItems] = useState<MatchFormatDraft[]>([]);
  const [newDraft, setNewDraft] = useState<MatchFormatDraft>(defaultDraft());
  const [editingItemId, setEditingItemId] = useState<string | undefined>();

  const getToken = async (): Promise<string | undefined> => {
    if (!authEnabled || !isAuthenticated) {
      return undefined;
    }
    try {
      return await getAccessTokenSilently();
    } catch {
      return undefined;
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const presets = await fetchMatchFormatPresets();
      const drafts = presets.map(toDraft);
      setItems(drafts);
      setMatchFormatPresets(presets.map((preset) => ({
        key: preset.key,
        durationMinutes: preset.durationMinutes,
        segments: preset.segments,
      })));
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to load match formats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const isAsciiDigit = (character: string): boolean => character >= '0' && character <= '9';

  const extractIntegers = (value: string): number[] => {
    const numbers: number[] = [];
    let currentDigits = '';

    for (const character of value) {
      if (isAsciiDigit(character)) {
        currentDigits += character;
        continue;
      }

      if (currentDigits.length > 0) {
        const parsed = Number.parseInt(currentDigits, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          numbers.push(parsed);
        }
        currentDigits = '';
      }
    }

    if (currentDigits.length > 0) {
      const parsed = Number.parseInt(currentDigits, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        numbers.push(parsed);
      }
    }

    return numbers;
  };

  const extractTrailingInteger = (value: string): number | null => {
    let index = value.length - 1;

    while (index >= 0 && value[index] === ' ') {
      index -= 1;
    }

    if (index < 0 || !isAsciiDigit(value[index] ?? '')) {
      return null;
    }

    let start = index;
    while (start >= 0 && isAsciiDigit(value[start] ?? '')) {
      start -= 1;
    }

    const numberChunk = value.slice(start + 1, index + 1);
    const parsed = Number.parseInt(numberChunk, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  };

  const extractTargetCount = (description: string): number | null => {
    const normalized = description.toLowerCase();
    const markerIndex = normalized.indexOf('tableau');
    if (markerIndex > 0) {
      const trailingValue = extractTrailingInteger(normalized.slice(0, markerIndex));
      if (trailingValue !== null) {
        return trailingValue;
      }
    }

    const parsedValues = extractIntegers(description);
    if (parsedValues.length === 0) {
      return null;
    }

    // Ignore game identifiers (501/701) and keep only valid board counts.
    const boardCounts = parsedValues.filter((value) => value >= 1 && value <= 10 && value !== 501 && value !== 701);
    if (boardCounts.length === 0) {
      return null;
    }

    return Math.max(...boardCounts);
  };

  const parseSegmentDescription = (description: string): MatchFormatPresetSegment | undefined => {
    const normalized = description.trim();
    if (!normalized) {
      return undefined;
    }

    const lower = normalized.toLowerCase();
    let game: MatchFormatPresetSegment['game'] | undefined;

    if (lower.includes('cricket')) {
      game = 'CRICKET';
    } else if (lower.includes('701')) {
      game = '701_DO';
    } else if (lower.includes('501')) {
      game = '501_DO';
    }
    const targetCount = extractTargetCount(normalized) ?? DEFAULT_SEGMENT_TARGET_COUNT;

    if (!game) {
      return undefined;
    }

    return { game, targetCount };
  };

  const buildSegmentPayload = (segments: SegmentDraft[]): MatchFormatPresetSegment[] => {
    const payload: MatchFormatPresetSegment[] = [];
    for (const [index, segment] of segments.entries()) {
      const parsed = parseSegmentDescription(segment.description);
      if (!parsed) {
        throw new Error(`Segment ${index + 1}: format invalide. Exemples: "501 DO" ou "501 DO - 4 Tableaux"`);
      }
      payload.push(parsed);
    }
    return payload;
  };

  const replaceSegments = (
    item: MatchFormatDraft,
    update: (segments: SegmentDraft[]) => SegmentDraft[]
  ): MatchFormatDraft => ({
    ...item,
    segments: update(item.segments),
  });

  const patchSegmentById = (
    segments: SegmentDraft[],
    segmentId: string,
    patch: Partial<SegmentDraft>
  ): SegmentDraft[] => segments.map((segment) => (
    segment.id === segmentId ? { ...segment, ...patch } : segment
  ));

  const removeSegmentById = (segments: SegmentDraft[], segmentId: string): SegmentDraft[] => (
    segments.filter((segment) => segment.id !== segmentId)
  );

  const appendDefaultSegment = (segments: SegmentDraft[]): SegmentDraft[] => ([
    ...segments,
    { id: crypto.randomUUID(), description: '501 DO' },
  ]);

  const updateSegment = (
    itemIndex: number,
    segmentId: string,
    patch: Partial<SegmentDraft>
  ) => {
    setItems((current) => {
      const existing = current[itemIndex];
      if (!existing) {
        return current;
      }
      const next = [...current];
      next[itemIndex] = replaceSegments(existing, (segments) => patchSegmentById(segments, segmentId, patch));
      return next;
    });
  };

  const updateItem = (itemIndex: number, patch: Partial<MatchFormatDraft>) => {
    setItems((current) => {
      const existing = current[itemIndex];
      if (!existing) {
        return current;
      }
      const next = [...current];
      next[itemIndex] = { ...existing, ...patch };
      return next;
    });
  };

  const removeItemSegment = (itemIndex: number, segmentId: string) => {
    setItems((current) => {
      const existing = current[itemIndex];
      if (!existing) {
        return current;
      }
      const next = [...current];
      next[itemIndex] = replaceSegments(existing, (segments) => removeSegmentById(segments, segmentId));
      return next;
    });
  };

  const addItemSegment = (itemIndex: number) => {
    setItems((current) => {
      const existing = current[itemIndex];
      if (!existing) {
        return current;
      }
      const next = [...current];
      next[itemIndex] = replaceSegments(existing, appendDefaultSegment);
      return next;
    });
  };

  const updateNewDraftSegment = (segmentId: string, patch: Partial<SegmentDraft>) => {
    setNewDraft((current) => ({
      ...current,
      segments: current.segments.map((segment) => (
        segment.id === segmentId ? { ...segment, ...patch } : segment
      )),
    }));
  };

  const removeNewDraftSegment = (segmentId: string) => {
    setNewDraft((current) => ({
      ...current,
      segments: current.segments.filter((segment) => segment.id !== segmentId),
    }));
  };

  const addNewDraftSegment = () => {
    setNewDraft((current) => ({
      ...current,
      segments: [...current.segments, { id: crypto.randomUUID(), description: '501 DO' }],
    }));
  };

  const saveItem = async (item: MatchFormatDraft) => {
    if (!isAdmin || !item.id) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const token = await getToken();
      const segments = buildSegmentPayload(item.segments);
      await updateMatchFormatPreset(item.id, {
        key: item.key,
        durationMinutes: item.durationMinutes,
        segments,
      }, token);
      setEditingItemId(undefined);
      await refresh();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to save format');
    } finally {
      setSubmitting(false);
    }
  };

  const getItemIdentifier = (item: MatchFormatDraft, itemIndex: number) => (
    item.id ?? `${item.key}-${itemIndex}`
  );

  const removeItem = async (item: MatchFormatDraft) => {
    if (!isAdmin || !item.id || item.isSystem) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const token = await getToken();
      await deleteMatchFormatPreset(item.id, token);
      await refresh();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to delete format');
    } finally {
      setSubmitting(false);
    }
  };

  const createItem = async () => {
    if (!isAdmin) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const token = await getToken();
      const segments = buildSegmentPayload(newDraft.segments);
      await createMatchFormatPreset({
        key: newDraft.key,
        durationMinutes: newDraft.durationMinutes,
        segments,
      }, token);
      setNewDraft(defaultDraft());
      await refresh();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to create format');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('app.title')}</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Match formats</h2>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-900/20 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!isAdmin && (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4 text-sm text-slate-300">
          Lecture seule (admin requis pour modifier).
        </div>
      )}

      {isAdmin && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-900/10 p-4 text-sm text-cyan-100">
          Cliquez sur <span className="font-semibold">Modifier</span> sur un format, éditez les champs, puis <span className="font-semibold">Save</span>.
        </div>
      )}

      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4 text-sm text-slate-300">
        Chaque segment est un champ texte libre, par exemple: <span className="font-semibold text-slate-100">501 DO</span> ou <span className="font-semibold text-slate-100">501 DO - 4 Tableaux</span>.
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading match formats...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item, itemIndex) => {
            const itemIdentifier = getItemIdentifier(item, itemIndex);
            const isEditing = editingItemId === itemIdentifier;
            return (
            <article key={itemIdentifier} className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-400">
                  <span>Key</span>
                  <input
                    value={item.key}
                    onChange={(event_) => updateItem(itemIndex, { key: event_.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    disabled={!isAdmin || submitting || !isEditing}
                  />
                </label>
                <label className="text-xs text-slate-400">
                  <span>Duration (min)</span>
                  <input
                    type="number"
                    value={item.durationMinutes}
                    onChange={(event_) => updateItem(itemIndex, { durationMinutes: Number(event_.target.value) })}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                    disabled={!isAdmin || submitting || !isEditing}
                  />
                </label>
              </div>
              <div className="mt-4 space-y-2">
                {item.segments.map((segment, segmentIndex) => (
                  <div key={segment.id} className="rounded-md border border-slate-800/70 bg-slate-900/40 p-2">
                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        type="text"
                        value={segment.description}
                        onChange={(event_) => updateSegment(itemIndex, segment.id, { description: event_.target.value })}
                        aria-label={`Description du segment ${segmentIndex + 1}`}
                        title="Description libre du segment"
                        className="md:col-span-2 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                        disabled={!isAdmin || submitting || !isEditing}
                      />
                      <button
                      type="button"
                      onClick={() => removeItemSegment(itemIndex, segment.id)}
                      className="rounded-md border border-rose-500/50 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
                      disabled={!isAdmin || submitting || !isEditing || item.segments.length <= 1}
                    >
                      Remove
                    </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addItemSegment(itemIndex)}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
                  disabled={!isAdmin || submitting || !isEditing}
                >
                  Add segment
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItemId(itemIdentifier)}
                  className="rounded-md border border-cyan-500/60 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                  disabled={!isAdmin || submitting}
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void saveItem(item);
                  }}
                  className="rounded-md border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"
                  disabled={!isAdmin || submitting || !isEditing}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItemId(undefined);
                    void refresh();
                  }}
                  className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
                  disabled={!isAdmin || submitting || !isEditing}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void removeItem(item);
                  }}
                  className="rounded-md border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
                  disabled={!isAdmin || submitting || item.isSystem}
                >
                  Delete
                </button>
              </div>
            </article>
          );})}
        </div>
      )}

      {isAdmin && (
        <article className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5">
          <h3 className="text-sm font-semibold text-white">Create new format</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-400">
              <span>Key</span>
              <input
                value={newDraft.key}
                onChange={(event_) => setNewDraft((current) => ({ ...current, key: event_.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                disabled={submitting}
              />
            </label>
            <label className="text-xs text-slate-400">
              <span>Duration (min)</span>
              <input
                type="number"
                value={newDraft.durationMinutes}
                onChange={(event_) => setNewDraft((current) => ({ ...current, durationMinutes: Number(event_.target.value) }))}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                disabled={submitting}
              />
            </label>
          </div>
          <div className="mt-4 space-y-2">
            {newDraft.segments.map((segment, segmentIndex) => (
              <div key={segment.id} className="rounded-md border border-slate-800/70 bg-slate-900/40 p-2">
                <div className="grid gap-2 md:grid-cols-3">
                <input
                  type="text"
                  value={segment.description}
                  onChange={(event_) => updateNewDraftSegment(segment.id, { description: event_.target.value })}
                  aria-label={`Description du segment ${segmentIndex + 1}`}
                  title="Description libre du segment"
                  className="md:col-span-2 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-white"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => removeNewDraftSegment(segment.id)}
                  className="rounded-md border border-rose-500/50 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
                  disabled={submitting || newDraft.segments.length <= 1}
                >
                  Remove
                </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addNewDraftSegment}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
              disabled={submitting}
            >
              Add segment
            </button>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                void createItem();
              }}
              className="rounded-md border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"
              disabled={submitting}
            >
              Create format
            </button>
          </div>
        </article>
      )}
    </section>
  );
};

export default MatchFormatsView;
