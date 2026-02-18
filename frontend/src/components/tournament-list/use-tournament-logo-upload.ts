import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { uploadTournamentLogo } from '../../services/tournament-service';
import type { Tournament, Translator } from './types';

type UseTournamentLogoUploadProperties = {
  t: Translator;
  editingTournament: Tournament | undefined;
  logoFile: File | undefined;
  getSafeAccessToken: () => Promise<string | undefined>;
  setEditError: Dispatch<SetStateAction<string | undefined>>;
  setIsUploadingLogo: Dispatch<SetStateAction<boolean>>;
  setEditingTournament: Dispatch<SetStateAction<Tournament | undefined>>;
  setLogoFile: Dispatch<SetStateAction<File | undefined>>;
  fetchTournaments: () => void;
};

type TournamentLogoUploadResult = {
  uploadLogo: () => Promise<void>;
};

const useTournamentLogoUpload = ({
  t,
  editingTournament,
  logoFile,
  getSafeAccessToken,
  setEditError,
  setIsUploadingLogo,
  setEditingTournament,
  setLogoFile,
  fetchTournaments,
}: UseTournamentLogoUploadProperties): TournamentLogoUploadResult => {
  const uploadLogo = useCallback(async () => {
    if (!editingTournament || !logoFile) return;
    setIsUploadingLogo(true);
    setEditError(undefined);
    try {
      const token = await getSafeAccessToken();
      const result = await uploadTournamentLogo(editingTournament.id, logoFile, token);
      setEditingTournament((current) => {
        if (!current) return current;
        const nextLogoUrl = result?.logo_url;
        if (!nextLogoUrl) return current;
        return { ...current, logoUrl: nextLogoUrl };
      });
      setLogoFile(undefined);
      fetchTournaments();
    } catch (error_) {
      setEditError(error_ instanceof Error ? error_.message : t('edit.error.failedUploadLogo'));
    } finally {
      setIsUploadingLogo(false);
    }
  }, [editingTournament, fetchTournaments, getSafeAccessToken, logoFile, setEditError, setEditingTournament, setIsUploadingLogo, setLogoFile, t]);

  return { uploadLogo };
};

export default useTournamentLogoUpload;
