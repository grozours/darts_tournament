import type { LiveViewData, Translator } from './types';

type TargetsViewHeaderProperties = {
  t: Translator;
  tournamentId: string | null | undefined;
  scopedViews: LiveViewData[];
};

const TargetsViewHeader = ({ t, tournamentId, scopedViews }: TargetsViewHeaderProperties) => (
  <div>
    <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">{t('targets.title')}</p>
    {tournamentId && scopedViews[0] && (
      <>
        <h2 className="text-2xl font-semibold text-white mt-2">{scopedViews[0].name}</h2>
        <p className="mt-1 text-xs text-slate-500">ID: {scopedViews[0].id}</p>
      </>
    )}
  </div>
);

export default TargetsViewHeader;
