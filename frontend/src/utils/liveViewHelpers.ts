export type LiveViewMode = string | null;

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

export const hasActivePoolStages = (view: LiveViewLike) =>
  (view.poolStages || []).some(
    (stage) => stage.status === 'IN_PROGRESS' && (stage.pools?.length || 0) > 0
  );

export const hasActiveBrackets = (view: LiveViewLike) =>
  (view.brackets || []).some(
    (bracket) => bracket.status === 'IN_PROGRESS' && (bracket.matches?.length || 0) > 0
  );

export const getVisibleLiveViews = (viewMode: LiveViewMode, views: LiveViewLike[]) => {
  if (isPoolStagesView(viewMode)) {
    return views.filter(hasActivePoolStages);
  }
  if (isBracketsView(viewMode)) {
    return views.filter(hasActiveBrackets);
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
