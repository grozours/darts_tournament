import type { Tournament, Translator } from './types';

export type TournamentCardProperties = {
  tournament: Tournament;
  normalizedStatus: string;
  statusLabel: string;
  showWaitingSignature: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  t: Translator;
  onEdit: (tournament: Tournament) => void;
  onDelete: (tournamentId: string) => void;
  onRegister: (tournamentId: string) => void;
  onUnregister: (tournamentId: string) => void;
  onOpenRegistration: (tournamentId: string) => void;
  onOpenSignature: (tournamentId: string) => void;
  onAutoFillPlayers: (tournamentId: string) => void;
  onConfirmAllPlayers: (tournamentId: string) => void;
  hideOpenSignatureAction?: boolean;
  showOpenAutoFillAction?: boolean;
  showSignatureAutoConfirmAction?: boolean;
  registeringTournamentId?: string | undefined;
  openingRegistrationId?: string | undefined;
  openingSignatureId?: string | undefined;
  autoFillingTournamentId?: string | undefined;
  confirmingTournamentId?: string | undefined;
  userRegistrations: Set<string>;
};

type TournamentAdminActionProperties = {
  tournament: Tournament;
  normalizedStatus: string;
  openingRegistrationId?: string | undefined;
  openingSignatureId?: string | undefined;
  autoFillingTournamentId?: string | undefined;
  confirmingTournamentId?: string | undefined;
  onOpenRegistration: (tournamentId: string) => void;
  onOpenSignature: (tournamentId: string) => void;
  onAutoFillPlayers: (tournamentId: string) => void;
  onConfirmAllPlayers: (tournamentId: string) => void;
  hideOpenSignatureAction?: boolean;
  showOpenAutoFillAction?: boolean;
  showSignatureAutoConfirmAction?: boolean;
  onEdit: (tournament: Tournament) => void;
  onDelete: (tournamentId: string) => void;
  t: Translator;
};

type TournamentRegistrationActionProperties = {
  tournamentId: string;
  showRegistrationActions: boolean;
  isRegistered: boolean;
  registeringTournamentId?: string | undefined;
  onRegister: (tournamentId: string) => void;
  onUnregister: (tournamentId: string) => void;
  t: Translator;
};

const TournamentAdminActions = ({
  tournament,
  normalizedStatus,
  openingRegistrationId,
  openingSignatureId,
  autoFillingTournamentId,
  confirmingTournamentId,
  onOpenRegistration,
  onOpenSignature,
  onAutoFillPlayers,
  onConfirmAllPlayers,
  hideOpenSignatureAction = false,
  showOpenAutoFillAction = false,
  showSignatureAutoConfirmAction = false,
  onEdit,
  onDelete,
  t,
}: TournamentAdminActionProperties) => (
  <>
    {normalizedStatus === 'DRAFT' && (
      <button
        onClick={() => onOpenRegistration(tournament.id)}
        disabled={openingRegistrationId === tournament.id}
        className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {openingRegistrationId === tournament.id
          ? t('common.loading')
          : t('tournaments.openRegistration')}
      </button>
    )}
    {normalizedStatus === 'OPEN' && !hideOpenSignatureAction && showOpenAutoFillAction && (
      <button
        onClick={() => onAutoFillPlayers(tournament.id)}
        disabled={autoFillingTournamentId === tournament.id}
        className="w-full rounded-full border border-slate-700 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {autoFillingTournamentId === tournament.id
          ? t('edit.filling')
          : t('edit.autoFillPlayers')}
      </button>
    )}
    {normalizedStatus === 'OPEN' && !hideOpenSignatureAction && (
      <button
        onClick={() => onOpenSignature(tournament.id)}
        disabled={openingSignatureId === tournament.id}
        className="w-full rounded-full border border-cyan-500/60 px-4 py-1.5 text-center text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {openingSignatureId === tournament.id
          ? t('common.loading')
          : t('tournaments.openSignature')}
      </button>
    )}
    {normalizedStatus === 'SIGNATURE' && showSignatureAutoConfirmAction && (
      <button
        onClick={() => onConfirmAllPlayers(tournament.id)}
        disabled={confirmingTournamentId === tournament.id}
        className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {confirmingTournamentId === tournament.id
          ? t('edit.confirming')
          : t('tournaments.autoSignature')}
      </button>
    )}
    <button
      onClick={() => onEdit(tournament)}
      className="w-full rounded-full border border-slate-700 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
    >
      {t('tournaments.edit')}
    </button>
    <button
      onClick={() => onDelete(tournament.id)}
      className="w-full rounded-full border border-rose-500/60 px-4 py-1.5 text-center text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 sm:w-auto"
    >
      {t('tournaments.delete')}
    </button>
  </>
);

const TournamentRegistrationActions = ({
  tournamentId,
  showRegistrationActions,
  isRegistered,
  registeringTournamentId,
  onRegister,
  onUnregister,
  t,
}: TournamentRegistrationActionProperties) => {
  if (!showRegistrationActions) {
    return null;
  }

  if (isRegistered) {
    return (
      <button
        onClick={() => onUnregister(tournamentId)}
        disabled={registeringTournamentId === tournamentId}
        className="w-full rounded-full border border-amber-500/60 px-4 py-1.5 text-center text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {registeringTournamentId === tournamentId
          ? t('common.loading')
          : t('tournaments.unregister')}
      </button>
    );
  }

  return (
    <button
      onClick={() => onRegister(tournamentId)}
      disabled={registeringTournamentId === tournamentId}
      className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {registeringTournamentId === tournamentId
        ? t('common.loading')
        : t('tournaments.register')}
    </button>
  );
};

const TournamentCard = ({
  tournament,
  normalizedStatus,
  statusLabel,
  showWaitingSignature,
  isAdmin,
  isAuthenticated,
  t,
  onEdit,
  onDelete,
  onRegister,
  onUnregister,
  onOpenRegistration,
  onOpenSignature,
  onAutoFillPlayers,
  onConfirmAllPlayers,
  hideOpenSignatureAction = false,
  showOpenAutoFillAction = false,
  showSignatureAutoConfirmAction = false,
  registeringTournamentId,
  openingRegistrationId,
  openingSignatureId,
  autoFillingTournamentId,
  confirmingTournamentId,
  userRegistrations,
}: TournamentCardProperties) => {
  const isLive = normalizedStatus === 'LIVE';
  const isFinished = normalizedStatus === 'FINISHED';
  const isRegistered = userRegistrations.has(tournament.id);
  const showRegistrationActions = isAuthenticated && !isLive;
  const tournamentId = tournament.id;
  const poolStagesUrl = `/?view=pool-stages&tournamentId=${tournamentId}${isFinished ? '&status=FINISHED' : ''}`;
  const bracketsUrl = `/?view=brackets&tournamentId=${tournamentId}${isFinished ? '&status=FINISHED' : ''}`;

  return (
  <div
    className="group relative overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.8)] transition hover:border-cyan-400/50 hover:shadow-[0_20px_60px_-40px_rgba(34,211,238,0.8)]"
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {tournament.logoUrl && (
          <div className="h-12 w-12 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/60">
            <img
              src={tournament.logoUrl}
              alt={tournament.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div>
          <h3 className="mb-1 text-lg font-semibold text-white">
            {tournament.name}
          </h3>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tournament.format}</p>
          {tournament.location && (
            <p className="mt-1 text-xs text-slate-400">{tournament.location}</p>
          )}
          <p className="mt-1 break-all text-xs text-slate-500">ID: {tournamentId}</p>
        </div>
      </div>
      <span className="w-fit rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">
        {statusLabel}
      </span>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('common.players')}</p>
        <p className="mt-2 text-lg font-semibold text-white">{tournament.totalParticipants}</p>
        <p className="mt-1 text-xs text-slate-400">
          {t('tournaments.registered')}: {tournament.currentParticipants ?? 0}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">{t('common.status')}</p>
        <p className="mt-2 text-lg font-semibold text-white">{statusLabel}</p>
      </div>
    </div>

    {!showWaitingSignature && (
      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        <a
          href={`/?view=tournament-players&tournamentId=${tournamentId}`}
          className="w-full rounded-full border border-cyan-500/60 px-4 py-1.5 text-center text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 sm:w-auto"
        >
          {t('tournaments.registered')}
        </a>
        <a
          href={poolStagesUrl}
          className="w-full rounded-full border border-slate-700 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
        >
          {t('nav.poolStagesShort')}
        </a>
        <a
          href={bracketsUrl}
          className="w-full rounded-full border border-slate-700 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white sm:w-auto"
        >
          {t('nav.bracketsShort')}
        </a>
        {normalizedStatus === 'LIVE' && (
          <a
            href={`/?view=live&tournamentId=${tournament.id}`}
            className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 sm:w-auto"
          >
            {t('tournaments.viewLive')}
          </a>
        )}
        {isAdmin ? (
          <TournamentAdminActions
            tournament={tournament}
            normalizedStatus={normalizedStatus}
            openingRegistrationId={openingRegistrationId}
            openingSignatureId={openingSignatureId}
            autoFillingTournamentId={autoFillingTournamentId}
            onOpenRegistration={onOpenRegistration}
            onOpenSignature={onOpenSignature}
            onAutoFillPlayers={onAutoFillPlayers}
            onConfirmAllPlayers={onConfirmAllPlayers}
            hideOpenSignatureAction={hideOpenSignatureAction}
            showOpenAutoFillAction={showOpenAutoFillAction}
            showSignatureAutoConfirmAction={showSignatureAutoConfirmAction}
            onEdit={onEdit}
            onDelete={onDelete}
            t={t}
            confirmingTournamentId={confirmingTournamentId}
          />
        ) : (
          <TournamentRegistrationActions
            tournamentId={tournamentId}
            registeringTournamentId={registeringTournamentId}
            showRegistrationActions={showRegistrationActions}
            isRegistered={isRegistered}
            onRegister={onRegister}
            onUnregister={onUnregister}
            t={t}
          />
        )}
      </div>
    )}
  </div>
  );
};

export default TournamentCard;
