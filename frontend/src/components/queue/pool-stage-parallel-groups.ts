type StageLike = {
  id: string;
  stageNumber: number;
  inParallelWith?: string[];
};

const getStageParallelReferences = (stage: StageLike) => (
  new Set(
    (stage.inParallelWith ?? [])
      .map((reference) => reference.trim())
      .filter((reference) => /^stage:\d+$/i.test(reference))
      .map((reference) => Number(reference.split(':')[1]))
      .filter((stageNumber) => Number.isInteger(stageNumber) && stageNumber > 0)
  )
);

const areStagesParallelLinked = (firstStage: StageLike, secondStage: StageLike) => {
  const firstReferences = getStageParallelReferences(firstStage);
  const secondReferences = getStageParallelReferences(secondStage);
  return firstReferences.has(secondStage.stageNumber) || secondReferences.has(firstStage.stageNumber);
};

const collectParallelStageGroup = <TStage extends StageLike>(
  startStage: TStage,
  orderedStages: TStage[],
  visitedStageIds: Set<string>
) => {
  const group: TStage[] = [];
  const stack = [startStage];
  visitedStageIds.add(startStage.id);

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    group.push(current);

    for (const candidate of orderedStages) {
      if (visitedStageIds.has(candidate.id)) {
        continue;
      }
      if (areStagesParallelLinked(current, candidate)) {
        visitedStageIds.add(candidate.id);
        stack.push(candidate);
      }
    }
  }

  return group.toSorted((leftStage, rightStage) => leftStage.stageNumber - rightStage.stageNumber);
};

export const buildPoolStageParallelGroups = <TStage extends StageLike>(stages: TStage[]) => {
  const orderedStages = [...stages].sort((leftStage, rightStage) => leftStage.stageNumber - rightStage.stageNumber);
  const visitedStageIds = new Set<string>();
  const groups: TStage[][] = [];

  for (const stage of orderedStages) {
    if (visitedStageIds.has(stage.id)) {
      continue;
    }

    groups.push(collectParallelStageGroup(stage, orderedStages, visitedStageIds));
  }

  return groups.toSorted((firstGroup, secondGroup) => {
    const firstOrder = firstGroup[0]?.stageNumber ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = secondGroup[0]?.stageNumber ?? Number.MAX_SAFE_INTEGER;
    return firstOrder - secondOrder;
  });
};