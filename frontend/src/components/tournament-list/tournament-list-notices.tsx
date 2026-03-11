export type TournamentListNoticesProperties = {
  isEditPage: boolean;
  editLoadError: string | null | undefined;
  editLoading: boolean;
  showAnonymousOpenRegistrationHint: boolean;
  t: (key: string) => string;
};

const TournamentListNotices = ({
  isEditPage,
  editLoadError,
  editLoading,
  showAnonymousOpenRegistrationHint,
  t,
}: TournamentListNoticesProperties) => (
  <>
    {isEditPage && editLoadError && (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        {editLoadError}
      </div>
    )}
    {isEditPage && editLoading && (
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <div className="h-4 w-4 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
        {t('tournaments.loading')}
      </div>
    )}
    {showAnonymousOpenRegistrationHint && (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
        {t('tournaments.signInRequiredForOpenRegistration')}
      </div>
    )}
  </>
);

export default TournamentListNotices;
