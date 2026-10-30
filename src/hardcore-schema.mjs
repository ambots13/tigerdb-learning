const slug = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildVocabulary(activity) {
  const terms = new Map();
  const add = (term, simpleMeaning, technicalMeaning, example) => {
    if (!terms.has(term)) terms.set(term, { term, simpleMeaning, technicalMeaning, example });
  };
  add('evidence', 'A fact you can show someone else.', 'An observed query result, plan, or written record that supports a claim.', activity.evidence?.[0] ?? 'A saved query result.');
  if (activity.sql || activity.starterSql) {
    add('query', 'A question written for the database.', 'A SQL statement that asks for or changes data.', activity.sql ?? activity.starterSql);
  }
  if (activity.type === 'assessment') {
    add('invariant', 'A rule that should stay true.', 'A property used to check whether a system is behaving correctly.', activity.evidence?.[0] ?? 'The expected result shape.');
  }
  return [...terms.values()];
}

function normalizeStep(instruction, index, activity) {
  const action = asText(instruction) || `Complete step ${index + 1}.`;
  const expectedResult = activity.sql || activity.starterSql
    ? 'The query finishes and returns the columns or plan needed for this activity.'
    : 'You have a concrete note, table, or answer for this step.';
  return {
    id: `${activity.id}-step-${index + 1}`,
    action,
    reason: `This creates the next piece of evidence for “${activity.title}”.`,
    expectedResult,
    explanation: 'Compare your result with the completion check before moving on.',
    troubleshooting: 'If the result is different, save the exact error or output, check the lesson prerequisites, and ask the tutor about this step.',
  };
}

export function normalizeActivity(activity, sourceIndex) {
  const instructions = Array.isArray(activity.instructions) ? activity.instructions : [];
  const evidence = Array.isArray(activity.evidence) ? activity.evidence : [];
  const sql = activity.sql ?? activity.starterSql ?? '';
  const answer = activity.solution ?? activity.workedAnswer?.answer ?? (
    evidence.length ? `Complete the requested work and show: ${evidence.join('; ')}.` : 'Complete each step and explain what you observed.'
  );
  const sourceRefs = (activity.sourceIds ?? []).map((sourceId) => sourceIndex.get(sourceId)).filter(Boolean);
  const steps = activity.steps ?? instructions.map((instruction, index) => normalizeStep(instruction, index, activity));
  const typical = Math.max(15, Math.round((steps.length * 4 + (sql ? 5 : 8))));
  const firstEvidence = typeof evidence[0] === 'string' ? evidence[0] : evidence[0]?.item;
  const multipleChoice = sql ? undefined : activity.multipleChoice ?? (
    Number.isInteger(activity.beforeYouRun?.answer)
      ? {
          question: activity.beforeYouRun.predictionQuestion,
          options: activity.beforeYouRun.predictionChoices,
          answer: activity.beforeYouRun.answer,
          explanation: activity.beforeYouRun.explanation,
        }
      : {
          question: `Which evidence would best show that you completed “${activity.title}”?`,
          options: [
            firstEvidence ?? 'The concrete evidence named by the activity.',
            'A successful but unrelated SQL query.',
            'A conclusion based only on intuition, with no recorded reasoning.',
          ],
          answer: 0,
          explanation: `Completion requires the named evidence: ${firstEvidence ?? 'a concrete result or written explanation that supports the claim.'}`,
        }
  );

  return {
    ...activity,
    required: activity.required !== false,
    goal: activity.goal ?? activity.purpose,
    whyItMatters: activity.whyItMatters ?? `This helps you use ${activity.title.toLowerCase()} safely in a real database.`,
    prerequisites: activity.prerequisites ?? ['The matching lesson has been completed', 'A working connection to the lesson database'],
    vocabulary: activity.vocabulary ?? buildVocabulary(activity),
    beforeYouRun: activity.beforeYouRun ?? {
      predictionQuestion: 'Before you begin, what result shape do you expect?',
      predictionChoices: ['A single value', 'Several rows with named columns', 'A query plan or written explanation'],
      explanation: 'A prediction gives you something specific to compare with the real result.',
    },
    multipleChoice,
    steps,
    sqlWalkthrough: activity.sqlWalkthrough ?? (sql ? [{ fragment: sql, explanation: 'Run this statement after making your prediction.', lessonConnection: activity.purpose }] : []),
    hints: activity.hints ?? [
      { level: 1, text: `Start with the first action: ${steps[0]?.action ?? 'read the completion check'}` },
      { level: 2, text: 'Use the exact object, column, or output named in the evidence list.' },
      { level: 3, text: answer },
      { level: 4, text: `Worked answer: ${answer}` },
    ],
    workedAnswer: activity.workedAnswer ?? {
      answer,
      explanation: activity.solution ? 'This is one complete reference approach. Equivalent SQL or wording is acceptable when it proves the same invariant.' : 'This example shows the required shape. Your observed values may differ with database state.',
      acceptableVariations: activity.acceptableVariations ?? ['Equivalent SQL or wording that produces the same evidence.'],
      template: `I found [the named object or result]. It means [plain-language interpretation]. Evidence: [${evidence[0] ?? 'completion evidence'}].`,
      example: `I found the requested result and can show ${evidence[0] ?? 'the completion evidence'}.`,
    },
    commonMistakes: activity.commonMistakes ?? [{
      symptom: 'The result does not match the expected shape.',
      cause: 'A prerequisite, filter, object name, or time range is different.',
      fix: 'Compare the statement and connection with the lesson setup, then rerun one small step.',
    }],
    evidence: evidence.map((item) => typeof item === 'string'
      ? { item, example: item, completionCheck: `I can show ${item.toLowerCase()}.` }
      : item),
    sourceRefs,
    estimatedMinutes: activity.estimatedMinutes && typeof activity.estimatedMinutes === 'object'
      ? activity.estimatedMinutes
      : { minimum: Math.max(3, typical - 4), typical, maximum: typical + 8 },
    // Keep the legacy instruction list for older clients and saved lessons.
    instructions,
    legacyEvidence: evidence,
  };
}

export function normalizeSource(source) {
  const heading = source.locator?.heading ?? source.title;
  const url = source.url;
  return {
    ...source,
    documentTitle: source.documentTitle ?? source.title,
    locator: source.locator ?? {
      heading,
      subheading: source.locator?.subheading ?? '',
      anchor: `${url}#${slug(heading)}`,
      searchPhrase: heading,
    },
    readFor: source.readFor ?? source.note ?? `Read the section named “${heading}”.`,
    relevantSummary: source.relevantSummary ?? source.note ?? 'Use this source to check the documented behavior.',
    shortExcerpt: source.shortExcerpt ?? '',
    lastVerified: source.lastVerified ?? '2026-10-30',
  };
}

export function normalizeDeepDive(deepDive) {
  const sources = deepDive.sources.map(normalizeSource);
  const sourceIndex = new Map(sources.map((source) => [source.id, source]));
  const phases = deepDive.phases.map((phase) => ({
    ...phase,
    activities: phase.activities.map((activity) => normalizeActivity(activity, sourceIndex)),
    minutes: phase.minutes ?? phase.activities.reduce((total, activity) => total + (activity.estimatedMinutes?.typical ?? 15), 0),
  }));
  return {
    ...deepDive,
    sources,
    phases,
    estimatedMinutes: phases.reduce((total, phase) => total + phase.minutes, 0),
  };
}
