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
  const genericPhrases = [
    'Which evidence would best show',
    'You have a concrete note, table, or answer',
    'Complete the requested work and show',
  ];
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
  if (!activity.sql && !activity.starterSql) {
    if (!activity.checks?.length) {
      errors.push('non-SQL activity must contain authored checks');
    }
    const checkIds = new Set();
    for (const check of activity.checks ?? []) {
      if (!check.id?.trim()) errors.push('check id is empty');
      if (checkIds.has(check.id)) errors.push(`duplicate check ${check.id}`);
      checkIds.add(check.id);
      if (!check.question?.trim()) errors.push('multiple choice question is empty');
      if (!Array.isArray(check.options) || check.options.length < 3) {
        errors.push('multiple choice must contain at least three options');
      }
      if (new Set(check.options).size !== check.options?.length) {
        errors.push(`${check.id} multiple choice options must be distinct`);
      }
      if (!Number.isInteger(check.answer) || check.answer < 0 || check.answer >= (check.options?.length ?? 0)) {
        errors.push('multiple choice answer is invalid');
      }
      if (!check.explanation?.trim()) errors.push('multiple choice explanation is empty');
      if (check.retryExplanations?.length !== check.options?.length) {
        errors.push(`${check.id} must have one retry explanation per option`);
      } else {
        check.retryExplanations.forEach((retry, optionIndex) => {
          if (optionIndex !== check.answer && !retry?.trim()) {
            errors.push(`${check.id} option ${optionIndex + 1} is missing retry feedback`);
          }
        });
      }
    }
    for (const step of activity.steps ?? []) {
      if (/^(write|draw|sketch|prove)\b/i.test(step.action)) {
        errors.push(`${step.id} requires an unsupported written or drawn response`);
      }
    }
    const qualityText = [
      activity.workedAnswer?.answer,
      ...(activity.steps ?? []).flatMap((step) => [step.action, step.expectedResult]),
      ...(activity.checks ?? []).map((check) => check.question),
    ].filter(Boolean);
    for (const phrase of genericPhrases) {
      if (qualityText.some((text) => text.includes(phrase))) {
        errors.push(`contains generic learning text: ${phrase}`);
      }
    }
  }
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
