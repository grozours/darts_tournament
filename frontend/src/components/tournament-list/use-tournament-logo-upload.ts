import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  deleteTournamentLogo,
  fetchTournamentLogos,
  uploadTournamentLogo,
} from '../../services/tournament-service';
import type { Tournament, Translator } from './types';

type UseTournamentLogoUploadProperties = {
  t: Translator;
  editingTournament: Tournament | undefined;
  logoFiles: File[];
  getSafeAccessToken: () => Promise<string | undefined>;
  setEditError: Dispatch<SetStateAction<string | undefined>>;
  setIsUploadingLogo: Dispatch<SetStateAction<boolean>>;
  setEditingTournament: Dispatch<SetStateAction<Tournament | undefined>>;
  setLogoFiles: Dispatch<SetStateAction<File[]>>;
  fetchTournaments: () => void;
};

type TournamentLogoUploadResult = {
  uploadLogo: () => Promise<void>;
  deleteLogo: (logoUrl: string) => Promise<void>;
};

type UploadLogoResult = { logo_url?: string; logo_urls?: string[]; logoUrl?: string; logoUrls?: string[] };

const mergeLogoUrls = (...values: Array<string[] | undefined>) => {
  const merged = values.flatMap((entry) => entry ?? []);
  return Array.from(new Set(merged.filter((entry): entry is string => entry.trim().length > 0)));
};

const applyUploadedLogos = (
  current: Tournament | undefined,
  refreshedLogos: { logoUrl?: string; logoUrls?: string[] },
  latestResult: UploadLogoResult | undefined
): Tournament | undefined => {
  if (!current) {
    return current;
  }

  const nextLogoUrl = refreshedLogos.logoUrl
    ?? latestResult?.logoUrl
    ?? latestResult?.logo_url
    ?? current.logoUrl;
  const nextLogoUrls = mergeLogoUrls(
    refreshedLogos.logoUrls,
    latestResult?.logoUrls,
    latestResult?.logo_urls,
    current.logoUrls,
    nextLogoUrl ? [nextLogoUrl] : []
  );

  return {
    ...current,
    ...(nextLogoUrl ? { logoUrl: nextLogoUrl } : {}),
    ...(nextLogoUrls.length > 0 ? { logoUrls: nextLogoUrls } : { logoUrls: [] }),
  };
};

const applyDeletedLogo = (
  current: Tournament | undefined,
  result: { logoUrl?: string; logoUrls?: string[] }
): Tournament | undefined => {
  if (!current) {
    return current;
  }

  const nextLogoUrl = result.logoUrl;
  const nextLogoUrls = mergeLogoUrls(result.logoUrls);

  if (nextLogoUrl) {
    return {
      ...current,
      logoUrl: nextLogoUrl,
      logoUrls: nextLogoUrls,
    };
  }

  const currentWithoutLogoUrl = { ...current };
  delete currentWithoutLogoUrl.logoUrl;

  return {
    ...currentWithoutLogoUrl,
    logoUrls: nextLogoUrls,
  };
};

const useTournamentLogoUpload = ({
  t,
  editingTournament,
  logoFiles,
  getSafeAccessToken,
  setEditError,
  setIsUploadingLogo,
  setEditingTournament,
  setLogoFiles,
  fetchTournaments,
}: UseTournamentLogoUploadProperties): TournamentLogoUploadResult => {
  const uploadLogo = useCallback(async () => {
    if (!editingTournament || logoFiles.length === 0) return;

    setIsUploadingLogo(true);
    setEditError(undefined);
    try {
      const token = await getSafeAccessToken();
      let latestResult: UploadLogoResult | undefined;

      for (const logoFile of logoFiles) {
        const result = await uploadTournamentLogo(editingTournament.id, logoFile, token);
        latestResult = result ?? latestResult;
      }

      const refreshedLogos = await fetchTournamentLogos(editingTournament.id, token);
      setEditingTournament((current) => applyUploadedLogos(current, refreshedLogos, latestResult));
      setLogoFiles([]);
      fetchTournaments();
    } catch (error_) {
      setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedUploadLogo'));
    } finally {
      setIsUploadingLogo(false);
    }
  }, [editingTournament, fetchTournaments, getSafeAccessToken, logoFiles, setEditError, setEditingTournament, setIsUploadingLogo, setLogoFiles, t]);

  const deleteLogo = useCallback(async (logoUrl: string) => {
    if (!editingTournament || !logoUrl) {
      return;
    }

    setIsUploadingLogo(true);
    setEditError(undefined);

    try {
      const token = await getSafeAccessToken();
      const result = await deleteTournamentLogo(editingTournament.id, logoUrl, token);
      setEditingTournament((current) => applyDeletedLogo(current, result));
      fetchTournaments();
    } catch (error_) {
      setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedUploadLogo'));
    } finally {
      setIsUploadingLogo(false);
    }
  }, [editingTournament, fetchTournaments, getSafeAccessToken, setEditError, setEditingTournament, setIsUploadingLogo, t]);

  return { uploadLogo, deleteLogo };
};

export default useTournamentLogoUpload;
