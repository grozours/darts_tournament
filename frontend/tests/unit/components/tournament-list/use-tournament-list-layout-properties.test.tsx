import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTournamentListLayoutProperties from '../../../../src/components/tournament-list/use-tournament-list-layout-properties';

const useTournamentListSharedDataMock = vi.fn();
const useTournamentListEditingDataMock = vi.fn();
const composeOverviewPropertiesMock = vi.fn();

vi.mock('../../../../src/components/tournament-list/use-tournament-list-shared-data', () => ({
  default: () => useTournamentListSharedDataMock(),
}));

vi.mock('../../../../src/components/tournament-list/use-tournament-list-editing-data', () => ({
  default: (input: unknown) => useTournamentListEditingDataMock(input),
}));

vi.mock('../../../../src/components/tournament-list/compose-tournament-list-overview-section-properties', () => ({
  default: (input: unknown) => composeOverviewPropertiesMock(input),
}));

describe('useTournamentListLayoutProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useTournamentListSharedDataMock.mockReturnValue({
      t: (key: string) => key,
      auth: {
        enabled: true,
        isLoading: false,
        isAuthenticated: true,
      },
      isAdmin: true,
      effectiveIsAuthenticated: true,
      viewContext: {
        isEditPage: false,
        editTournamentId: null,
        selectedTournamentId: 't-anchor',
        hideOpenSignatureAction: false,
        showOpenAutoFillAction: true,
        showSignatureAutoConfirmAction: true,
      },
      getSafeAccessToken: vi.fn(async () => 'token'),
      getStatusLabel: vi.fn((scope: string, status: string) => `${scope}:${status}`),
      refreshTournaments: vi.fn(),
      visibleTournaments: [{ id: 't-anchor' }],
      listData: {
        loading: false,
        error: undefined,
        deleteTournament: vi.fn(async () => undefined),
      },
      grouping: {
        groupedTournaments: [{ status: 'OPEN', title: 'Open', items: [{ id: 't-anchor' }] }],
      },
      registrations: {
        userRegistrations: new Set<string>(),
        userGroupStatuses: {},
        registeringTournamentId: undefined,
        handleRegisterSelf: vi.fn(async () => undefined),
        handleRegisterGroup: vi.fn(async () => undefined),
        handleUnregisterGroup: vi.fn(async () => undefined),
        handleUnregisterSelf: vi.fn(async () => undefined),
      },
      cardActions: {
        openDraftFromCard: vi.fn(async () => undefined),
        openLiveFromCard: vi.fn(async () => undefined),
        openRegistrationFromCard: vi.fn(async () => undefined),
        openSignatureFromCard: vi.fn(async () => undefined),
        autoFillTournamentFromCard: vi.fn(async () => undefined),
        confirmAllFromCard: vi.fn(async () => undefined),
        openingDraftId: undefined,
        openingLiveId: 't-anchor',
        openingRegistrationId: undefined,
        openingSignatureId: undefined,
        autoFillingTournamentId: undefined,
        confirmingTournamentId: undefined,
        autoFillProgressByTournament: {},
        confirmAllProgressByTournament: {},
      },
      showAnonymousOpenRegistrationHint: false,
    });

    useTournamentListEditingDataMock.mockReturnValue({
      editingTournament: undefined,
      editLoadError: undefined,
      editLoading: false,
      openEdit: vi.fn(),
      editSectionProperties: { section: 'edit' },
      poolStageAssignmentsModalProperties: { modal: 'pool' },
    });

    composeOverviewPropertiesMock.mockImplementation((input: unknown) => input);
  });

  it('passes selected tournament id and live action wiring to overview properties', () => {
    const { result } = renderHook(() => useTournamentListLayoutProperties());

    expect(composeOverviewPropertiesMock).toHaveBeenCalledWith(expect.objectContaining({
      selectedTournamentId: 't-anchor',
      onOpenLive: expect.any(Function),
      openingLiveId: 't-anchor',
    }));
    expect(result.current.overviewSectionProperties.selectedTournamentId).toBe('t-anchor');
    expect(result.current.overviewSectionProperties.openingLiveId).toBe('t-anchor');
  });
});
