import { useRef, useState } from 'react';
import SignInPanel from '../auth/sign-in-panel';
import { useOptionalAuth } from '../auth/optional-auth';
import { useAdminStatus } from '../auth/use-admin-status';
import { useI18n } from '../i18n';

type UserImportSummary = {
  rowsRead: number;
  accountsDetected: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  issues?: string[];
  tournamentImport?: {
    tournamentsCreated: number;
    tournamentsUpdated: number;
    singleRegistrationsCreated: number;
    doublettesCreated: number;
    doublePlayersCreated: number;
    singlePoolStagesCount?: number;
    singleBracketsCount?: number;
    doublePoolStagesCount?: number;
    doubleBracketsCount?: number;
    issues?: string[];
  };
};

const buildAuthorizationHeaders = (token: string | undefined): HeadersInit => (
  token ? { Authorization: `Bearer ${token}` } : {}
);

const buildImportNotice = (t: (key: string) => string, summary: UserImportSummary): string => {
  const base = t('userAccounts.importSuccess')
    .replace('{created}', String(summary.createdCount))
    .replace('{updated}', String(summary.updatedCount))
    .replace('{skipped}', String(summary.skippedCount))
    .replace('{detected}', String(summary.accountsDetected))
    .replace('{rows}', String(summary.rowsRead));

  const details: string[] = [];
  if (summary.tournamentImport) {
    details.push(
      `Tournois +${summary.tournamentImport.tournamentsCreated}`,
      `MAJ ${summary.tournamentImport.tournamentsUpdated}`,
      `Inscriptions simple +${summary.tournamentImport.singleRegistrationsCreated}`,
      `Doublettes +${summary.tournamentImport.doublettesCreated}`,
      `Simple phases ${summary.tournamentImport.singlePoolStagesCount ?? 0}`,
      `Simple brackets ${summary.tournamentImport.singleBracketsCount ?? 0}`,
      `Double phases ${summary.tournamentImport.doublePoolStagesCount ?? 0}`,
      `Double brackets ${summary.tournamentImport.doubleBracketsCount ?? 0}`
    );
  }

  let firstIssue: string | undefined;
  if (Array.isArray(summary.issues) && summary.issues.length > 0) {
    firstIssue = summary.issues[0];
  } else if (Array.isArray(summary.tournamentImport?.issues) && summary.tournamentImport.issues.length > 0) {
    firstIssue = summary.tournamentImport.issues[0];
  }

  const extra = details.length > 0 ? ` ${details.join(' | ')}` : '';
  const issueSuffix = firstIssue ? ` ${firstIssue}` : '';
  return `${base}${extra}${issueSuffix}`;
};

function ImportView() {
  const { t } = useI18n();
  const {
    enabled: authEnabled,
    isAuthenticated,
    isLoading,
    getAccessTokenSilently,
  } = useOptionalAuth();
  const { isAdmin } = useAdminStatus();

  const [importing, setImporting] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const importInputReference = useRef<HTMLInputElement | null>(null);

  const importAccountsFile = async (file: File) => {
    if (!isAdmin || importing) {
      return;
    }

    setImporting(true);
    setError(undefined);
    setNotice(undefined);

    try {
      const content = await file.text();
      const token = authEnabled ? await getAccessTokenSilently() : undefined;
      const response = await fetch('/api/auth/users/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthorizationHeaders(token),
        },
        body: JSON.stringify({
          fileName: file.name,
          content,
          includeTournamentImport: true,
        }),
      });

      const payload = await response.json().catch(() => undefined) as (UserImportSummary & { message?: string }) | undefined;
      if (!response.ok || !payload) {
        throw new Error(payload?.message ?? 'userAccounts.importFailed');
      }

      setNotice(buildImportNotice(t, payload));
      setSelectedImportFile(undefined);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'userAccounts.importFailed');
    } finally {
      if (importInputReference.current) {
        importInputReference.current.value = '';
      }
      setImporting(false);
    }
  };

  const onImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedImportFile(file ?? undefined);
  };

  const submitImportFile = () => {
    if (!selectedImportFile) {
      return;
    }

    void importAccountsFile(selectedImportFile);
  };

  const displayedError = error?.startsWith('userAccounts.') ? t(error) : error;

  if (isLoading) {
    return <p className="text-slate-300">{t('account.loading')}</p>;
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <SignInPanel
        title={t('auth.signInRequired')}
        description={t('auth.protectedContinue')}
      />
    );
  }

  if (!isAdmin) {
    return <p className="text-slate-300">{t('auth.adminOnly')}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">Import</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Importation</h2>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/65 to-slate-950/65 p-4 shadow-[0_8px_30px_rgba(2,6,23,0.35)]">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="cursor-pointer rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20">
            <input
              ref={importInputReference}
              type="file"
              accept=".tsv,.csv,text/tab-separated-values,text/csv"
              className="sr-only"
              onChange={onImportFileChange}
              aria-label={t('userAccounts.importButton')}
            />
            {importing ? t('common.loading') : t('userAccounts.importButton')}
          </label>

          <button
            type="button"
            onClick={submitImportFile}
            disabled={!selectedImportFile || importing}
            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? t('common.loading') : t('userAccounts.importSendButton')}
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-800/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
          <p className="font-medium text-slate-100">{t('userAccounts.importHintTitle')}</p>
          <p className="mt-1 text-xs text-slate-400">{t('userAccounts.importHintBody')}</p>
          {selectedImportFile && (
            <p className="mt-2 text-xs text-cyan-200">
              {t('userAccounts.importSelectedFile')}: {selectedImportFile.name}
            </p>
          )}
        </div>
      </div>

      {displayedError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{displayedError}</div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</div>
      )}
    </div>
  );
}

export default ImportView;
