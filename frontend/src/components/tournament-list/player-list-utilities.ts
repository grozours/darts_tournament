import type { Translator } from './types';

type PlayerActionLabelOptions = {
  isRegistering: boolean;
  isAutoFilling: boolean;
  isEditing: boolean;
  t: Translator;
};

export const getPlayerActionLabel = (options: PlayerActionLabelOptions) => {
  if (options.isRegistering || options.isAutoFilling) {
    return options.t('edit.saving');
  }
  if (options.isEditing) {
    return options.t('edit.saveChanges');
  }
  return options.t('edit.addPlayer');
};
