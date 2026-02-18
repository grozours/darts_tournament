import type { Translator } from './types';

type TournamentEditHeaderProperties = {
  t: Translator;
  onClose: () => void;
};

const TournamentEditHeader = ({ t, onClose }: TournamentEditHeaderProperties) => (
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold text-white">{t('edit.title')}</h3>
    <button
      onClick={onClose}
      className="text-sm text-slate-400 hover:text-white"
    >
      {t('edit.close')}
    </button>
  </div>
);

export default TournamentEditHeader;
