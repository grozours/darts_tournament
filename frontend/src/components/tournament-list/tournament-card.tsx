import { useCallback, useRef } from 'react';
import type { Tournament, Translator, UserTournamentGroupStatus } from './types';
import { QRCodeSVG } from 'qrcode.react';

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
  onRegisterGroup: (tournamentId: string) => void;
  onUnregisterGroup: (tournamentId: string) => void;
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
  autoFillProgress?: { current: number; total: number } | undefined;
  confirmAllProgress?: { current: number; total: number } | undefined;
  userRegistrations: Set<string>;
  userGroupStatus: UserTournamentGroupStatus | undefined;
};

type TournamentAdminActionProperties = {
  tournament: Tournament;
  normalizedStatus: string;
  openingRegistrationId?: string | undefined;
  openingSignatureId?: string | undefined;
  autoFillingTournamentId?: string | undefined;
  confirmingTournamentId?: string | undefined;
  autoFillProgress?: { current: number; total: number } | undefined;
  confirmAllProgress?: { current: number; total: number } | undefined;
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
  tournamentFormat: string;
  tournamentId: string;
  isAdmin: boolean;
  showRegistrationActions: boolean;
  isRegistered: boolean;
  userGroupStatus: UserTournamentGroupStatus | undefined;
  registeringTournamentId?: string | undefined;
  onRegister: (tournamentId: string) => void;
  onRegisterGroup: (tournamentId: string) => void;
  onUnregisterGroup: (tournamentId: string) => void;
  onUnregister: (tournamentId: string) => void;
  t: Translator;
};

const isGroupFormat = (format: string): format is 'DOUBLE' | 'TEAM_4_PLAYER' => (
  format === 'DOUBLE' || format === 'TEAM_4_PLAYER'
);

const getGroupViewHref = (format: 'DOUBLE' | 'TEAM_4_PLAYER', tournamentId: string): string => (
  format === 'DOUBLE'
    ? `/?view=doublettes&tournamentId=${tournamentId}`
    : `/?view=equipes&tournamentId=${tournamentId}`
);

const getGroupCreateLabelKey = (format: 'DOUBLE' | 'TEAM_4_PLAYER'): string => (
  format === 'DOUBLE' ? 'tournaments.createOwnDoublette' : 'tournaments.createOwnEquipe'
);

const getGroupRegisterLabel = ({
  tournamentFormat,
  registeringTournamentId,
  tournamentId,
  isGroupRegistered,
  t,
}: {
  tournamentFormat: 'DOUBLE' | 'TEAM_4_PLAYER';
  registeringTournamentId: string | undefined;
  tournamentId: string;
  isGroupRegistered: boolean;
  t: Translator;
}): string => {
  if (registeringTournamentId === tournamentId) {
    return t('common.loading');
  }
  if (isGroupRegistered) {
    return t('tournaments.registered');
  }
  return tournamentFormat === 'DOUBLE' ? t('groups.registerDoublette') : t('groups.registerEquipe');
};

const GroupRegistrationAction = ({
  tournamentFormat,
  tournamentId,
  isAdmin,
  userGroupStatus,
  registeringTournamentId,
  onRegisterGroup,
  onUnregisterGroup,
  t,
}: {
  tournamentFormat: 'DOUBLE' | 'TEAM_4_PLAYER';
  tournamentId: string;
  isAdmin: boolean;
  userGroupStatus: UserTournamentGroupStatus | undefined;
  registeringTournamentId: string | undefined;
  onRegisterGroup: (tournamentId: string) => void;
  onUnregisterGroup: (tournamentId: string) => void;
  t: Translator;
}) => {
  if (!userGroupStatus?.hasGroup) {
    return (
      <a
        href={getGroupViewHref(tournamentFormat, tournamentId)}
        className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 sm:w-auto"
      >
        {t(getGroupCreateLabelKey(tournamentFormat))}
      </a>
    );
  }

  const disabled =
    registeringTournamentId === tournamentId
    || !userGroupStatus.isGroupComplete
    || userGroupStatus.isGroupRegistered;

  if (userGroupStatus.isGroupRegistered && (userGroupStatus.isGroupCaptain || isAdmin)) {
    return (
      <button
        onClick={() => onUnregisterGroup(tournamentId)}
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
      onClick={() => onRegisterGroup(tournamentId)}
      disabled={disabled}
      className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {getGroupRegisterLabel({
        tournamentFormat,
        registeringTournamentId,
        tournamentId,
        isGroupRegistered: userGroupStatus.isGroupRegistered,
        t,
      })}
    </button>
  );
};

const TournamentAdminActions = ({
  tournament,
  normalizedStatus,
  openingRegistrationId,
  openingSignatureId,
  autoFillingTournamentId,
  confirmingTournamentId,
  autoFillProgress,
  confirmAllProgress,
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
}: TournamentAdminActionProperties) => {
  const isAutoFillingCurrent = autoFillingTournamentId === tournament.id;
  const isConfirmingCurrent = confirmingTournamentId === tournament.id;

  let autoFillLabel = t('edit.autoFillPlayers');
  if (isAutoFillingCurrent) {
    const progressLabel = autoFillProgress
      ? ` (${autoFillProgress.current}/${autoFillProgress.total})`
      : '';
    autoFillLabel = `${t('edit.filling')}${progressLabel}`;
  }

  let autoConfirmLabel = t('tournaments.autoSignature');
  if (isConfirmingCurrent) {
    const progressLabel = confirmAllProgress
      ? ` (${confirmAllProgress.current}/${confirmAllProgress.total})`
      : '';
    autoConfirmLabel = `${t('edit.confirming')}${progressLabel}`;
  }

  return (
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
        disabled={isAutoFillingCurrent}
        className="w-full rounded-full border border-slate-700 px-4 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {autoFillLabel}
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
        disabled={isConfirmingCurrent}
        className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {autoConfirmLabel}
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
};

const TournamentRegistrationActions = ({
  tournamentFormat,
  tournamentId,
  isAdmin,
  showRegistrationActions,
  isRegistered,
  userGroupStatus,
  registeringTournamentId,
  onRegister,
  onRegisterGroup,
  onUnregisterGroup,
  onUnregister,
  t,
}: TournamentRegistrationActionProperties) => {
  if (!showRegistrationActions) {
    return null;
  }

  if (isGroupFormat(tournamentFormat)) {
    return (
      <GroupRegistrationAction
        tournamentFormat={tournamentFormat}
        tournamentId={tournamentId}
        isAdmin={isAdmin}
        userGroupStatus={userGroupStatus}
        registeringTournamentId={registeringTournamentId}
        onRegisterGroup={onRegisterGroup}
        onUnregisterGroup={onUnregisterGroup}
        t={t}
      />
    );
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
  onRegisterGroup,
  onUnregisterGroup,
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
  autoFillProgress,
  confirmAllProgress,
  userRegistrations,
  userGroupStatus,
}: TournamentCardProperties) => {
  const qrCodeReference = useRef<SVGSVGElement | null>(null);
  const isLive = normalizedStatus === 'LIVE';
  const isFinished = normalizedStatus === 'FINISHED';
  const isRegistered = userRegistrations.has(tournament.id);
  const showRegistrationActions = isAuthenticated && !isLive && !isFinished;
  const tournamentId = tournament.id;
  let participantLabel = t('common.players');
  if (tournament.format === 'DOUBLE') {
    participantLabel = t('groups.doublettes');
  } else if (tournament.format === 'TEAM_4_PLAYER') {
    participantLabel = t('groups.equipes');
  }
  let registeredViewHref = `/?view=tournament-players&tournamentId=${tournamentId}`;
  if (tournament.format === 'DOUBLE') {
    registeredViewHref = `/?view=doublettes&tournamentId=${tournamentId}`;
  } else if (tournament.format === 'TEAM_4_PLAYER') {
    registeredViewHref = `/?view=equipes&tournamentId=${tournamentId}`;
  }
  const poolStagesUrl = `/?view=pool-stages&tournamentId=${tournamentId}${isFinished ? '&status=FINISHED' : ''}`;
  const bracketsUrl = `/?view=brackets&tournamentId=${tournamentId}${isFinished ? '&status=FINISHED' : ''}`;
  const liveViewPath = `/?view=live&tournamentId=${encodeURIComponent(tournamentId)}`;
  const liveViewUrl = globalThis.window?.location
    ? `${globalThis.window.location.origin}${liveViewPath}`
    : liveViewPath;

  const handleQrOpen = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isAdmin) {
      return;
    }

    const svgElement = qrCodeReference.current;
    if (!svgElement) {
      return;
    }

    event.preventDefault();
    const svgForExport = svgElement.cloneNode(true) as SVGSVGElement;
    if (!svgForExport.getAttribute('xmlns')) {
      svgForExport.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!svgForExport.getAttribute('xmlns:xlink')) {
      svgForExport.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }

    const baseWidth = Number(svgForExport.getAttribute('width'));
    const baseHeight = Number(svgForExport.getAttribute('height'));
    if (Number.isFinite(baseWidth) && baseWidth > 0) {
      svgForExport.setAttribute('width', String(Math.round(baseWidth * 5)));
    }
    if (Number.isFinite(baseHeight) && baseHeight > 0) {
      svgForExport.setAttribute('height', String(Math.round(baseHeight * 5)));
    }

    const serializer = new XMLSerializer();
    const serializedSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(svgForExport)}`;
    const blob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const openedWindow = globalThis.window?.open(blobUrl, '_blank', 'noopener,noreferrer');
    if (!openedWindow) {
      URL.revokeObjectURL(blobUrl);
      return;
    }

    globalThis.window?.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60_000);
  }, [isAdmin]);

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
      <div className="flex flex-col items-end gap-2">
        <span className="w-fit rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">
          {statusLabel}
        </span>
        <a
          href={liveViewPath}
          aria-label={`Live QR ${tournament.name}`}
          title={liveViewUrl}
          onClick={handleQrOpen}
          className="rounded-lg border border-slate-700/70 bg-white p-1.5"
        >
          <QRCodeSVG ref={qrCodeReference} value={liveViewUrl} size={52} level="M" />
        </a>
      </div>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">{participantLabel}</p>
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
          href={registeredViewHref}
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
            href={liveViewPath}
            className="w-full rounded-full border border-emerald-500/60 px-4 py-1.5 text-center text-xs font-semibold text-emerald-200 transition hover:border-emerald-300 sm:w-auto"
          >
            {t('tournaments.viewLive')}
          </a>
        )}
        {isAdmin && !isFinished && (
          <TournamentAdminActions
            tournament={tournament}
            normalizedStatus={normalizedStatus}
            openingRegistrationId={openingRegistrationId}
            openingSignatureId={openingSignatureId}
            autoFillingTournamentId={autoFillingTournamentId}
            autoFillProgress={autoFillProgress}
            confirmAllProgress={confirmAllProgress}
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
        )}
        <TournamentRegistrationActions
          tournamentFormat={tournament.format}
          tournamentId={tournamentId}
            isAdmin={isAdmin}
          registeringTournamentId={registeringTournamentId}
          showRegistrationActions={showRegistrationActions}
          isRegistered={isRegistered}
          userGroupStatus={userGroupStatus}
          onRegister={onRegister}
          onRegisterGroup={onRegisterGroup}
            onUnregisterGroup={onUnregisterGroup}
          onUnregister={onUnregister}
          t={t}
        />
      </div>
    )}
  </div>
  );
};

export default TournamentCard;
