import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTournamentEditActions from '../../../../src/components/tournament-list/use-tournament-edit-actions';

const updateTournament = vi.fn();
const updateTournamentStatus = vi.fn();

vi.mock('../../../../src/services/tournament-service', () => ({
  updateTournament: (...args: unknown[]) => updateTournament(...args),
  updateTournamentStatus: (...args: unknown[]) => updateTournamentStatus(...args),
}));

vi.mock('../../../../src/components/tournament-list/tournament-date-helpers', () => ({
  localInputToIso: (value: string) => `iso:${value}`,
}));

describe('useTournamentEditActions', () => {
  beforeEach(() => {
    updateTournament.mockReset();
    updateTournamentStatus.mockReset();
  });

  const buildProperties = (override: Record<string, unknown> = {}) => ({
    t: (key: string) => key,
    isEditPage: false,
    editingTournament: { id: 't1', status: 'DRAFT' },
    editForm: {
      name: ' Cup ',
      location: ' Paris ',
      format: 'SINGLE',
      durationType: 'FIXED',
      startTime: '2026-01-01T10:00',
      endTime: '2026-01-01T18:00',
      totalParticipants: '16',
      targetCount: '8',
      targetStartNumber: '1',
      shareTargets: false,
      doubleStageEnabled: false,
    },
    players: [{ playerId: 'p1', checkedIn: true }],
    getSafeAccessToken: vi.fn(async () => 'token'),
    closeEdit: vi.fn(),
    fetchTournaments: vi.fn(),
    setEditError: vi.fn(),
    setIsSaving: vi.fn(),
    ...override,
  });

  it('validates save name and updates tournament payload', async () => {
    const missingName = buildProperties({ editForm: { name: '   ' } });
    const { result: missingResult } = renderHook(() => useTournamentEditActions(missingName as never));

    await act(async () => {
      await missingResult.current.saveEdit();
    });
    expect(missingName.setEditError).toHaveBeenCalledWith('edit.error.nameRequired');

    const props = buildProperties();
    const { result } = renderHook(() => useTournamentEditActions(props as never));
    updateTournament.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.saveEdit();
    });

    expect(updateTournament).toHaveBeenCalledWith('t1', expect.objectContaining({
      name: 'Cup',
      location: 'Paris',
      startTime: 'iso:2026-01-01T10:00',
      endTime: 'iso:2026-01-01T18:00',
      totalParticipants: 16,
    }), 'token');
    expect(props.closeEdit).toHaveBeenCalledTimes(1);
  });

  it('opens registration and closes edit in list mode', async () => {
    const props = buildProperties({ isEditPage: false });
    updateTournamentStatus.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTournamentEditActions(props as never));

    await act(async () => {
      await result.current.openRegistration();
    });

    expect(updateTournamentStatus).toHaveBeenCalledWith('t1', 'OPEN', 'token');
    expect(props.closeEdit).toHaveBeenCalledTimes(1);
    expect(props.fetchTournaments).toHaveBeenCalledTimes(1);
  });

  it('prevents move to live when status or check-ins are invalid', async () => {
    const propsWrongStatus = buildProperties({ editingTournament: { id: 't1', status: 'DRAFT' } });
    const { result: r1 } = renderHook(() => useTournamentEditActions(propsWrongStatus as never));

    await act(async () => {
      await r1.current.moveToLive();
    });
    expect(propsWrongStatus.setEditError).toHaveBeenCalledWith('edit.error.mustBeSignatureToLive');

    const propsUnchecked = buildProperties({ editingTournament: { id: 't1', status: 'SIGNATURE' }, players: [{ playerId: 'p1', checkedIn: false }] });
    const { result: r2 } = renderHook(() => useTournamentEditActions(propsUnchecked as never));

    await act(async () => {
      await r2.current.moveToLive();
    });
    expect(propsUnchecked.setEditError).toHaveBeenCalledWith('edit.error.allPlayersMustBeConfirmed');
  });

  it('uses fallback error when transition throws non-error', async () => {
    updateTournamentStatus.mockRejectedValue('boom');
    const props = buildProperties({ editingTournament: { id: 't1', status: 'OPEN' } });
    const { result } = renderHook(() => useTournamentEditActions(props as never));

    await act(async () => {
      await result.current.moveToSignature();
    });

    expect(props.setEditError).toHaveBeenCalledWith('edit.error.failedMoveToSignature');
  });

  it('keeps edit page on success for registration/signature transitions', async () => {
    updateTournamentStatus.mockResolvedValue(undefined);
    const props = buildProperties({
      isEditPage: true,
      editingTournament: { id: 't1', status: 'OPEN' },
    });

    const { result } = renderHook(() => useTournamentEditActions(props as never));

    await act(async () => {
      await result.current.moveToSignature();
    });

    expect(updateTournamentStatus).toHaveBeenCalledWith('t1', 'SIGNATURE', 'token');
    expect(props.closeEdit).not.toHaveBeenCalled();
    expect(props.fetchTournaments).not.toHaveBeenCalled();
  });

  it('prevents duplicate registration opening and invalid signature transition', async () => {
    const alreadyOpen = buildProperties({ editingTournament: { id: 't1', status: 'OPEN' } });
    const { result: openResult } = renderHook(() => useTournamentEditActions(alreadyOpen as never));

    await act(async () => {
      await openResult.current.openRegistration();
    });
    expect(alreadyOpen.setEditError).toHaveBeenCalledWith('edit.error.registrationAlreadyOpen');

    const notOpen = buildProperties({ editingTournament: { id: 't1', status: 'DRAFT' } });
    const { result: signatureResult } = renderHook(() => useTournamentEditActions(notOpen as never));

    await act(async () => {
      await signatureResult.current.moveToSignature();
    });
    expect(notOpen.setEditError).toHaveBeenCalledWith('edit.error.mustBeOpenToSignature');
  });
});
