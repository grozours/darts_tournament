export type LiveViewMode = string | null;
export type LiveViewStatus = string | null;

type PoolStageLike = {
  status?: string;
  pools?: Array<unknown>;
};

type BracketLike = {
  status?: string;
  matches?: Array<unknown>;
};

export type LiveViewLike = {
  poolStages?: PoolStageLike[];
  brackets?: BracketLike[];
};

export const isPoolStagesView = (viewMode: LiveViewMode) => viewMode === 'pool-stages';

export const isBracketsView = (viewMode: LiveViewMode) => viewMode === 'brackets';

export const hasActivePoolStages = (view: LiveViewLike, viewStatus?: LiveViewStatus) => {
  const allowedStatuses = viewStatus === 'FINISHED'
    ? new Set(['COMPLETED'])
    : new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']);
  return (view.poolStages || []).some(
    (stage) => allowedStatuses.has(stage.status ?? '') && (stage.pools?.length || 0) > 0
  );
};

export const hasActiveBrackets = (view: LiveViewLike, viewStatus?: LiveViewStatus) => {
  const targetStatus = viewStatus === 'FINISHED' ? 'COMPLETED' : 'IN_PROGRESS';
  return (view.brackets || []).some(
    (bracket) => bracket.status === targetStatus && (bracket.matches?.length || 0) > 0
  );
};

export const getVisibleLiveViews = (viewMode: LiveViewMode, views: LiveViewLike[], viewStatus?: LiveViewStatus) => {
  if (isPoolStagesView(viewMode)) {
    return views.filter((view) => hasActivePoolStages(view, viewStatus));
  }
  if (isBracketsView(viewMode)) {
    return views.filter((view) => hasActiveBrackets(view, viewStatus));
  }
  if (viewMode === 'live') {
    return views;
  }
  return views;
};

export const resolveEmptyLiveCopy = (viewMode: LiveViewMode, t: (key: string) => string, viewStatus?: LiveViewStatus) => {
  if (isBracketsView(viewMode)) {
    return viewStatus === 'FINISHED' ? t('live.noneBrackets') : t('live.noneBrackets');
  }
  if (isPoolStagesView(viewMode)) {
    return viewStatus === 'FINISHED' ? t('live.nonePoolStages') : t('live.nonePoolStages');
  }
  return t('live.none');
};
