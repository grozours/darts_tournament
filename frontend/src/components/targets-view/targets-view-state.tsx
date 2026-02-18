import { EmptyState, ErrorState, LoadingState } from '../shared/async-state';
import type { Translator } from './types';

type TargetsViewStateProperties = {
  t: Translator;
  loading: boolean;
  error: string | undefined;
  scopedViewsCount: number;
  onRetry: () => void;
};

const TargetsViewState = ({ t, loading, error, scopedViewsCount, onRetry }: TargetsViewStateProperties) => {
  if (loading) {
    return <LoadingState label={t('targets.loading')} />;
  }

  if (error) {
    return <ErrorState message={error} actionLabel={t('common.retry')} onRetry={onRetry} />;
  }

  if (scopedViewsCount === 0) {
    return <EmptyState message={t('targets.none')} />;
  }
  return <></>;
};

export default TargetsViewState;
