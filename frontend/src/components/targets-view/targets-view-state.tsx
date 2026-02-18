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
    return (
      <div className="flex items-center justify-center py-16">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        </div>
        <span className="ml-3 text-slate-300">{t('targets.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
        <div className="text-rose-200 mb-4">Error: {error}</div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-rose-500/80 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (scopedViewsCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
        {t('targets.none')}
      </div>
    );
  }
  return <></>;
};

export default TargetsViewState;
