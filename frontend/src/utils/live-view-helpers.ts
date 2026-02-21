export type LiveViewMode = string | undefined;
export type LiveViewStatus = string | undefined;

type PoolStageLike = {
  status?: string;
  pools?: PoolLike[];
  poolCount?: number;
};

type PoolLike = {
  assignments?: Array<unknown>;
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

export const hasActivePoolStages = (
  view: LiveViewLike,
  viewStatus?: LiveViewStatus,
  allowEmptyPools = false,
  screenMode = false
) => {
  let allowedStatuses = new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EDITION']);
  if (viewStatus === 'FINISHED') {
    allowedStatuses = new Set(['COMPLETED']);
  }
  if (screenMode) {
    allowedStatuses = new Set(['IN_PROGRESS']);
  }
  return (view.poolStages || []).some(
    (stage) => {
      if (!allowedStatuses.has(stage.status ?? '')) return false;
      const poolCount = stage.pools?.length ?? stage.poolCount ?? 0;
      if (poolCount <= 0) return false;
      if (!screenMode && allowEmptyPools) return true;
      return (stage.pools || []).some((pool) => (pool.assignments?.length ?? 0) > 0);
    }
  );
};

export const hasActiveBrackets = (
  view: LiveViewLike,
  viewStatus?: LiveViewStatus,
  canViewEdition = false,
  screenMode = false
) => {
  if (screenMode) {
    return (view.brackets || []).some(
      (bracket) => bracket.status === 'IN_PROGRESS' && (bracket.entries?.length ?? 0) > 0
    );
  }
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
  canViewEditionByViewId?: (viewId: string) => boolean,
  allowEmptyPoolsByViewId?: (viewId: string) => boolean,
  screenMode = false
) => {
  if (isPoolStagesView(viewMode)) {
    return views.filter((view) => hasActivePoolStages(
      view,
      viewStatus,
      allowEmptyPoolsByViewId ? allowEmptyPoolsByViewId(view.id) : false,
      screenMode
    ));
  }
  if (isBracketsView(viewMode)) {
    return views.filter((view) => hasActiveBrackets(
      view,
      viewStatus,
      canViewEditionByViewId ? canViewEditionByViewId(view.id) : false,
      screenMode
    ));
  }
  if (viewMode === 'live') {
    return views.filter((view) => {
      const allowEmptyPools = allowEmptyPoolsByViewId ? allowEmptyPoolsByViewId(view.id) : false;
      const canViewEdition = canViewEditionByViewId ? canViewEditionByViewId(view.id) : false;
      return hasActivePoolStages(view, viewStatus, allowEmptyPools, screenMode)
        || hasActiveBrackets(view, viewStatus, canViewEdition, screenMode);
    });
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
