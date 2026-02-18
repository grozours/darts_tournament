import { useMemo } from 'react';
import { DurationType, SkillLevel, TournamentFormat } from '@shared/types';
import type { Translator } from './types';

type TournamentOptionsResult = {
  formatOptions: Array<{ value: string; label: string }>;
  durationOptions: Array<{ value: string; label: string }>;
  skillLevelOptions: Array<{ value: string; label: string }>;
};

const useTournamentOptions = (t: Translator): TournamentOptionsResult => {
  const formatOptions = useMemo(
    () => [
      { value: TournamentFormat.SINGLE, label: t('format.single') },
      { value: TournamentFormat.DOUBLE, label: t('format.double') },
      { value: TournamentFormat.TEAM_4_PLAYER, label: t('format.team4') },
    ],
    [t]
  );

  const durationOptions = useMemo(
    () => [
      { value: DurationType.HALF_DAY_MORNING, label: t('duration.halfDayMorning') },
      { value: DurationType.HALF_DAY_AFTERNOON, label: t('duration.halfDayAfternoon') },
      { value: DurationType.HALF_DAY_NIGHT, label: t('duration.halfDayNight') },
      { value: DurationType.FULL_DAY, label: t('duration.fullDay') },
      { value: DurationType.TWO_DAY, label: t('duration.twoDay') },
    ],
    [t]
  );

  const skillLevelOptions = useMemo(
    () => [
      { value: SkillLevel.BEGINNER, label: t('skill.beginner') },
      { value: SkillLevel.INTERMEDIATE, label: t('skill.intermediate') },
      { value: SkillLevel.ADVANCED, label: t('skill.advanced') },
      { value: SkillLevel.EXPERT, label: t('skill.expert') },
    ],
    [t]
  );

  return {
    formatOptions,
    durationOptions,
    skillLevelOptions,
  };
};

export default useTournamentOptions;
