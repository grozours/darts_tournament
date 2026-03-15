import { normalizeTournamentStatus } from './tournament-status-helpers';

type TournamentListViewContext = {
  view: string | null;
  status: string | null;
  editTournamentId: string | null;
  selectedTournamentId: string | null;
  isEditPage: boolean;
  normalizedRequestedStatus: string;
  hideOpenSignatureAction: boolean;
  isRootStatusView: boolean;
  showOpenAutoFillAction: boolean;
  showSignatureAutoConfirmAction: boolean;
};

const useTournamentListViewContext = (): TournamentListViewContext => {
  const parameters = globalThis.window
    ? new URLSearchParams(globalThis.window.location.search)
    : new URLSearchParams();

  const view = parameters.get('view');
  const status = parameters.get('status');
  const requestedTournamentId = parameters.get('tournamentId');
  const isEditPage = view === 'edit-tournament';
  const editTournamentId = isEditPage ? requestedTournamentId : null;
  const selectedTournamentId = !isEditPage && requestedTournamentId ? requestedTournamentId : null;
  const normalizedRequestedStatus = normalizeTournamentStatus(status ?? undefined);
  const hideOpenSignatureAction = normalizedRequestedStatus === 'DRAFT';
  const isRootStatusView = normalizedRequestedStatus.length === 0;
  const showOpenAutoFillAction = isRootStatusView || normalizedRequestedStatus === 'OPEN';
  const showSignatureAutoConfirmAction = isRootStatusView || normalizedRequestedStatus === 'SIGNATURE';

  return {
    view,
    status,
    editTournamentId,
    selectedTournamentId,
    isEditPage,
    normalizedRequestedStatus,
    hideOpenSignatureAction,
    isRootStatusView,
    showOpenAutoFillAction,
    showSignatureAutoConfirmAction,
  };
};

export default useTournamentListViewContext;
