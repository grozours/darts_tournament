export type LiveViewMode = string | undefined;
export type LiveViewStatus = string | undefined;

type PoolStageLike = {
  status?: string;
  pools?: Array<unknown>;
  poolCount?: number;
};

type BracketLike = {
  status?: string;
  matches?: Array<unknown>;
};

export type LiveViewLike = {
  id: string;
  name: string;
  status: string;
  poolStages?: PoolStageLike[];
  brackets?: BracketLike[];
};

export const isPoolStagesView = (viewMode: LiveViewMode) => viewMode === 'pool-stages';

export const isBracketsView = (viewMode: LiveViewMode) => viewMode === 'brackets';

export const hasActivePoolStages = (view: LiveViewLike, viewStatus?: LiveViewStatus, canViewEdition = false) => {
  const allowedStatuses = viewStatus === 'FINISHED'
    ? new Set(['COMPLETED'])
    : new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']);
  if (canViewEdition && viewStatus !== 'FINISHED') {
    allowedStatuses.add('EDITION');
  }
  return (view.poolStages || []).some(
    (stage) => {
      if (!allowedStatuses.has(stage.status ?? '')) return false;
      const poolCount = stage.pools?.length ?? stage.poolCount ?? 0;
      return poolCount > 0;
    }
  );
};

export const hasActiveBrackets = (
  view: LiveViewLike,
  viewStatus?: LiveViewStatus,
  canViewEdition = false
) => {
  if (viewStatus === 'FINISHED') {
    return (view.brackets || []).some(
      (bracket) => bracket.status === 'COMPLETED' && (bracket.matches?.length || 0) > 0
    );
  }
  const allowedStatuses = new Set(['IN_PROGRESS']);
  if (canViewEdition) {
    allowedStatuses.add('NOT_STARTED');
  }
  return (view.brackets || []).some(
    (bracket) => allowedStatuses.has(bracket.status ?? '') && (bracket.matches?.length || 0) > 0
  );
};

export const getVisibleLiveViews = <T extends LiveViewLike>(
  viewMode: LiveViewMode,
  views: T[],
  viewStatus?: LiveViewStatus,
  canViewEditionByViewId?: (viewId: string) => boolean
) => {
  if (isPoolStagesView(viewMode)) {
    return views.filter((view) => hasActivePoolStages(
      view,
      viewStatus,
      canViewEditionByViewId ? canViewEditionByViewId(view.id) : false
    ));
  }
  if (isBracketsView(viewMode)) {
    return views.filter((view) => hasActiveBrackets(
      view,
      viewStatus,
      canViewEditionByViewId ? canViewEditionByViewId(view.id) : false
    ));
  }
  if (viewMode === 'live') {
    return views;
  }
  return views;
};

export const resolveEmptyLiveCopy = (viewMode: LiveViewMode, t: (key: string) => string) => {
  if (isBracketsView(viewMode)) {
    return t('live.noneBrackets');
  }
  if (isPoolStagesView(viewMode)) {
    return t('live.nonePoolStages');
  }
  return t('live.none');
};
