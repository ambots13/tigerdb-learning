const requiredActivityFields = [
  'id',
  'type',
  'required',
  'goal',
  'whyItMatters',
  'prerequisites',
  'vocabulary',
  'beforeYouRun',
  'steps',
  'hints',
  'workedAnswer',
  'commonMistakes',
  'evidence',
  'sourceRefs',
];

export function validateHardcoreActivity(activity) {
  const errors = [];
  for (const field of requiredActivityFields) {
    if (activity[field] === undefined || activity[field] === null) errors.push(`missing ${field}`);
  }
  if (!activity.steps?.length) errors.push('must contain at least one microstep');
  for (const step of activity.steps ?? []) {
    for (const field of ['action', 'reason', 'expectedResult', 'explanation', 'troubleshooting']) {
      if (!step[field]?.trim()) errors.push(`${step.id} missing ${field}`);
    }
  }
  if (!activity.hints || activity.hints.length < 4) errors.push('must contain four progressive hints');
  if (!activity.workedAnswer?.answer?.trim()) errors.push('worked answer is empty');
  if (!activity.workedAnswer?.template?.trim()) errors.push('worked answer is missing a template');
  if (!activity.workedAnswer?.example?.trim()) errors.push('worked answer is missing an example');
  if (!activity.evidence?.length) errors.push('must contain a concrete completion check');
  return errors;
}

export function validateHardcoreLesson(hardcore) {
  const errors = [];
  const activities = hardcore.deepDive?.phases.flatMap((phase) => phase.activities) ?? [];
  const ids = new Set();
  for (const activity of activities) {
    if (ids.has(activity.id)) errors.push(`duplicate activity ${activity.id}`);
    ids.add(activity.id);
    errors.push(...validateHardcoreActivity(activity).map((error) => `${activity.id}: ${error}`));
  }
  const sourceIds = new Set((hardcore.deepDive?.sources ?? []).map((source) => source.id));
  for (const source of hardcore.deepDive?.sources ?? []) {
    if (!source.locator?.heading && !source.locator?.anchor && !source.locator?.searchPhrase) {
      errors.push(`${source.id}: source has no exact locator`);
    }
  }
  for (const activity of activities) {
    for (const source of activity.sourceRefs ?? []) {
      if (!sourceIds.has(source.id)) errors.push(`${activity.id}: unknown source ${source.id}`);
    }
  }
  return errors;
}
