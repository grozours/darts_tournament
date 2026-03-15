import type { TournamentListOverviewSectionProperties } from './tournament-list-overview-section';

type ComposeTournamentListOverviewSectionPropertiesInput = Omit<
  TournamentListOverviewSectionProperties,
  'registeringTournamentId' | 'openingDraftId' | 'openingLiveId' | 'openingRegistrationId' | 'openingSignatureId' | 'autoFillingTournamentId' | 'confirmingTournamentId'
> & {
  registeringTournamentId: string | null | undefined;
  openingDraftId: string | null | undefined;
  openingLiveId: string | null | undefined;
  openingRegistrationId: string | null | undefined;
  openingSignatureId: string | null | undefined;
  autoFillingTournamentId: string | null | undefined;
  confirmingTournamentId: string | null | undefined;
};

const composeTournamentListOverviewSectionProperties = ({
  registeringTournamentId,
  openingDraftId,
  openingLiveId,
  openingRegistrationId,
  openingSignatureId,
  autoFillingTournamentId,
  confirmingTournamentId,
  ...properties
}: ComposeTournamentListOverviewSectionPropertiesInput): TournamentListOverviewSectionProperties => ({
  ...properties,
  registeringTournamentId: registeringTournamentId ?? undefined,
  openingDraftId: openingDraftId ?? undefined,
  openingLiveId: openingLiveId ?? undefined,
  openingRegistrationId: openingRegistrationId ?? undefined,
  openingSignatureId: openingSignatureId ?? undefined,
  autoFillingTournamentId: autoFillingTournamentId ?? undefined,
  confirmingTournamentId: confirmingTournamentId ?? undefined,
});

export default composeTournamentListOverviewSectionProperties;
