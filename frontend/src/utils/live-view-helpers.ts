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

const getAllowedPoolStageStatuses = (
  viewStatus?: LiveViewStatus,
  screenMode = false
) => {
  if (screenMode) {
    return new Set(['IN_PROGRESS']);
  }
  if (viewStatus === 'FINISHED') {
    return new Set(['COMPLETED']);
  }
  return new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EDITION']);
};

const hasPoolAssignments = (stage: PoolStageLike) => (
  (stage.pools || []).some((pool) => (pool.assignments?.length ?? 0) > 0)
);

const isVisiblePoolStage = (
  stage: PoolStageLike,
  allowedStatuses: Set<string>,
  allowEmptyPools: boolean,
  screenMode: boolean
) => {
  if (!allowedStatuses.has(stage.status ?? '')) {
    return false;
  }
  const poolCount = stage.pools?.length ?? stage.poolCount ?? 0;
  if (poolCount <= 0) {
    return false;
  }
  if (!screenMode && allowEmptyPools) {
    return true;
  }
  return hasPoolAssignments(stage);
};

const hasBracketMatches = (bracket: BracketLike) => (bracket.matches?.length || 0) > 0;

const getAllowedBracketStatuses = (canViewEdition: boolean) => {
  const allowedStatuses = new Set(['IN_PROGRESS']);
  if (canViewEdition) {
    allowedStatuses.add('NOT_STARTED');
  }
  return allowedStatuses;
};

const getAllowEmptyPoolsForView = (
  viewId: string,
  allowEmptyPoolsByViewId?: (viewId: string) => boolean
) => (allowEmptyPoolsByViewId ? allowEmptyPoolsByViewId(viewId) : false);

const getCanViewEditionForView = (
  viewId: string,
  canViewEditionByViewId?: (viewId: string) => boolean
) => (canViewEditionByViewId ? canViewEditionByViewId(viewId) : false);

export const hasActivePoolStages = (
  view: LiveViewLike,
  viewStatus?: LiveViewStatus,
  allowEmptyPools = false,
  screenMode = false
) => {
  const allowedStatuses = getAllowedPoolStageStatuses(viewStatus, screenMode);
  return (view.poolStages || []).some(
    (stage) => isVisiblePoolStage(stage, allowedStatuses, allowEmptyPools, screenMode)
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
      (bracket) => bracket.status === 'IN_PROGRESS' && hasBracketMatches(bracket)
    );
  }
  if (viewStatus === 'FINISHED') {
    return (view.brackets || []).some(
      (bracket) => bracket.status === 'COMPLETED' && hasBracketMatches(bracket)
    );
  }
  const allowedStatuses = getAllowedBracketStatuses(canViewEdition);
  return (view.brackets || []).some(
    (bracket) => {
      if (!allowedStatuses.has(bracket.status ?? '')) {
        return false;
      }
      if (canViewEdition) {
        return true;
      }
      return hasBracketMatches(bracket);
    }
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
      getAllowEmptyPoolsForView(view.id, allowEmptyPoolsByViewId),
      screenMode
    ));
  }
  if (isBracketsView(viewMode)) {
    return views.filter((view) => hasActiveBrackets(
      view,
      viewStatus,
      getCanViewEditionForView(view.id, canViewEditionByViewId),
      screenMode
    ));
  }
  if (viewMode === 'live') {
    return views.filter((view) => {
      const allowEmptyPools = getAllowEmptyPoolsForView(view.id, allowEmptyPoolsByViewId);
      const canViewEdition = getCanViewEditionForView(view.id, canViewEditionByViewId);
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
