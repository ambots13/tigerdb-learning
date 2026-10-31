const $ = (selector) => document.querySelector(selector);
const editor = $('#sql');
const resultEl = $('#result');
const tutorEl = $('#tutor');
const tutorContextEl = $('#tutor-context');
const tutorMessagesEl = $('#tutor-messages');
const tutorInput = $('#tutor-input');
const tutorForm = $('#tutor-form');
const sendTutorButton = $('#send-tutor');
const sqlInsight = $('#sql-insight');
const sqlInsightTitle = $('#sql-insight-title');
const sqlInsightWhat = $('#sql-insight-what');
const sqlInsightWhy = $('#sql-insight-why');
const sqlInsightRelated = $('#sql-insight-related');
const sqlInsightRelatedList = $('#sql-insight-related-list');
const learningModeSelect = $('#learning-mode');
const hardcoreProgressEl = $('#hardcore-progress');
let lessons = [];
let aiAvailable = false;
let activeTutor = null;
let chatMessages = [];
let learningMode = loadLearningMode();
let hardcoreProgress = loadHardcoreProgress();
let diagramSequence = 0;

window.mermaid?.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'dark',
  suppressErrorRendering: true,
  flowchart: { htmlLabels: false, useMaxWidth: true },
  themeVariables: {
    background: '#161b22',
    primaryColor: '#1c232c',
    primaryTextColor: '#e6edf3',
    primaryBorderColor: '#58a6ff',
    lineColor: '#8b949e',
    secondaryColor: '#2b3440',
    tertiaryColor: '#0d1117',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

function loadLearningMode() {
  try {
    return localStorage.getItem('tigerdb-learning-mode') === 'hardcore' ? 'hardcore' : 'standard';
  } catch {
    return 'standard';
  }
}

function loadHardcoreProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem('tigerdb-hardcore-progress-v1'));
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function lessonProgress(lesson) {
  const saved = hardcoreProgress[lesson.id];
  if (!saved || typeof saved !== 'object') hardcoreProgress[lesson.id] = {};
  const progress = hardcoreProgress[lesson.id];
  if (!Array.isArray(progress.steps)) progress.steps = [];
  if (!Array.isArray(progress.checkpoints)) progress.checkpoints = [];
  if (!Array.isArray(progress.drills)) progress.drills = [];
  if (!progress.deep || typeof progress.deep !== 'object' || Array.isArray(progress.deep)) {
    progress.deep = {};
  }
  if (!progress.multipleChoice || typeof progress.multipleChoice !== 'object' || Array.isArray(progress.multipleChoice)) {
    progress.multipleChoice = {};
  }
  if (!progress.activityChecks || typeof progress.activityChecks !== 'object' || Array.isArray(progress.activityChecks)) {
    progress.activityChecks = {};
  }
  return progress;
}

function saveHardcoreProgress() {
  try {
    localStorage.setItem('tigerdb-hardcore-progress-v1', JSON.stringify(hardcoreProgress));
  } catch (error) {
    console.warn('Hardcore progress could not be saved.', error);
  }
}

function saveLearningMode() {
  try {
    localStorage.setItem('tigerdb-learning-mode', learningMode);
  } catch (error) {
    console.warn('Learning mode preference could not be saved.', error);
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showSqlInsight(token) {
  sqlInsightTitle.textContent = token.dataset.insightTitle;
  sqlInsightWhat.textContent = token.dataset.insightWhat;
  sqlInsightWhy.textContent = token.dataset.insightWhy;
  sqlInsightRelatedList.innerHTML = '';
  const related = token.dataset.insightRelated
    ? JSON.parse(token.dataset.insightRelated)
    : [];
  for (const [name, summary] of related) {
    const item = el('li');
    item.append(el('code', null, name));
    item.append(document.createTextNode(` — ${summary}`));
    sqlInsightRelatedList.append(item);
  }
  sqlInsightRelated.hidden = related.length === 0;
  sqlInsight.hidden = false;

  const tokenRect = token.getBoundingClientRect();
  const tooltipRect = sqlInsight.getBoundingClientRect();
  const gap = 8;
  const left = Math.min(
    Math.max(gap, tokenRect.left),
    window.innerWidth - tooltipRect.width - gap,
  );
  const roomBelow = window.innerHeight - tokenRect.bottom;
  const top =
    roomBelow >= tooltipRect.height + gap
      ? tokenRect.bottom + gap
      : Math.max(gap, tokenRect.top - tooltipRect.height - gap);
  sqlInsight.style.left = `${left}px`;
  sqlInsight.style.top = `${top}px`;
}

function hideSqlInsight() {
  sqlInsight.hidden = true;
}

async function runSql(sql) {
  resultEl.innerHTML = '';
  resultEl.append(el('p', 'meta', 'Running...'));
  try {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    const data = await response.json();
    resultEl.innerHTML = '';

    if (!response.ok) {
      resultEl.append(el('div', 'error', data.error || 'Query failed.'));
      return;
    }

    const meta = el('p', 'meta');
    meta.append(el('span', 'ok', '✓ '));
    meta.append(
      document.createTextNode(
        `${data.rowCount} row(s) · ${data.ms} ms${data.command ? ` · ${data.command}` : ''}${
          data.truncated ? ' · showing first 200' : ''
        }`,
      ),
    );
    resultEl.append(meta);

    if (!data.rows.length) {
      resultEl.append(el('p', 'placeholder', 'Statement completed with no rows returned.'));
      return;
    }

    const columns = data.fields.length ? data.fields : Object.keys(data.rows[0]);

    // Query plans are text art: a table cell would destroy the indentation.
    if (columns.length === 1 && columns[0] === 'QUERY PLAN') {
      const plan = data.rows.map((row) => row['QUERY PLAN']).join('\n');
      resultEl.append(window.SqlGuide.renderPlan(plan));
      return;
    }

    const table = el('table');
    const thead = el('thead');
    const headRow = el('tr');
    for (const column of columns) headRow.append(el('th', null, column));
    thead.append(headRow);
    table.append(thead);

    const tbody = el('tbody');
    for (const row of data.rows) {
      const tr = el('tr');
      for (const column of columns) {
        const value = row[column];
        const td = el('td', value === null ? 'null' : null, value === null ? 'NULL' : String(value));
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);
    resultEl.append(table);
  } catch (error) {
    resultEl.innerHTML = '';
    resultEl.append(el('div', 'error', error.message));
  }
}

function addTutorMessage(role, content) {
  const message = el('p', `tutor-message ${role}`);
  message.append(el('b', null, `${role === 'user' ? 'You' : 'Tutor'}: `));
  message.append(document.createTextNode(content));
  tutorMessagesEl.append(message);
  tutorMessagesEl.scrollTop = tutorMessagesEl.scrollHeight;
}

function openTutor(lesson, context) {
  if (!aiAvailable) {
    window.alert('AI tutoring is not configured. Add OPENAI_API_KEY to .env, then restart the playground.');
    return;
  }
  activeTutor = { lessonId: lesson.id, ...context };
  chatMessages = [];
  tutorMessagesEl.innerHTML = '';
  tutorContextEl.textContent = context.label;
  addTutorMessage('assistant', `Ask me anything about ${context.label.toLowerCase()}.`);
  tutorEl.hidden = false;
  tutorInput.focus();
}

async function sendTutorMessage(event) {
  event.preventDefault();
  if (!activeTutor) return;
  const content = tutorInput.value.trim();
  if (!content) return;

  chatMessages.push({ role: 'user', content });
  addTutorMessage('user', content);
  tutorInput.value = '';
  sendTutorButton.disabled = true;
  sendTutorButton.textContent = 'Thinking...';
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...activeTutor, messages: chatMessages }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The tutor could not answer right now.');
    chatMessages.push({ role: 'assistant', content: data.reply });
    addTutorMessage('assistant', data.reply);
  } catch (error) {
    addTutorMessage('assistant', `Sorry, ${error.message}`);
  } finally {
    sendTutorButton.disabled = false;
    sendTutorButton.textContent = 'Ask';
    tutorInput.focus();
  }
}

function appendList(container, className, items) {
  const list = el('ul', className);
  for (const item of items) {
    const text = typeof item === 'string' ? item : item.item ?? item.example ?? '';
    list.append(el('li', null, text));
  }
  container.append(list);
}

function appendDisclosure(container, label, content, className = '') {
  const details = el('details', className);
  details.append(el('summary', null, label));
  details.append(el('p', null, content));
  container.append(details);
}

function renderDiagram(diagram, kind = 'technical') {
  const figure = el('figure', `lesson-diagram diagram-${kind}`);
  if (kind === 'analogy') {
    figure.append(el('div', 'diagram-kind', 'Everyday analogy'));
  }
  const caption = el('figcaption');
  caption.append(el('strong', null, diagram.title));
  figure.append(caption);

  const canvas = el('div', 'diagram-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', diagram.description || diagram.title);
  canvas.append(el('p', 'diagram-loading', 'Rendering diagram...'));
  figure.append(canvas);

  if (diagram.description) {
    figure.append(el('p', 'diagram-description', diagram.description));
  }

  const controls = el('div', 'diagram-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', `Zoom controls for ${diagram.title}`);
  controls.hidden = true;
  const zoomOut = el('button', 'ghost', 'Zoom out');
  const resetZoom = el('button', 'ghost', 'Reset');
  const zoomIn = el('button', 'ghost', 'Zoom in');
  const zoomStatus = el('span', 'diagram-zoom-status', '100%');
  zoomStatus.setAttribute('aria-live', 'polite');
  controls.append(zoomOut, resetZoom, zoomIn, zoomStatus);
  figure.append(controls);

  const source = el('details', 'diagram-source');
  source.append(el('summary', null, 'View diagram as text'));
  source.append(el('pre', null, diagram.source));
  figure.append(source);

  if (diagram.mapping) {
    const mapping = el('p', 'diagram-mapping');
    mapping.append(el('strong', null, 'Back to the database: '));
    mapping.append(document.createTextNode(diagram.mapping));
    figure.append(mapping);
  }

  if (!window.mermaid) {
    canvas.replaceChildren(el('p', 'diagram-error', 'Diagram renderer is unavailable. Use the text version below.'));
    return figure;
  }

  const id = `lesson-diagram-${diagramSequence += 1}`;
  window.mermaid.render(id, diagram.source)
    .then(({ svg, bindFunctions }) => {
      if (!figure.isConnected) return;
      canvas.innerHTML = svg;
      bindFunctions?.(canvas);
      const rendered = canvas.querySelector('svg');
      let zoom = 100;
      const applyZoom = (nextZoom) => {
        const oldWidth = canvas.scrollWidth;
        const centerRatio = oldWidth
          ? (canvas.scrollLeft + canvas.clientWidth / 2) / oldWidth
          : 0.5;
        zoom = Math.min(250, Math.max(75, nextZoom));
        rendered.style.width = `${zoom}%`;
        rendered.style.minWidth = `${4.6 * zoom}px`;
        rendered.style.maxWidth = 'none';
        zoomStatus.textContent = `${zoom}%`;
        zoomOut.disabled = zoom === 75;
        zoomIn.disabled = zoom === 250;
        resetZoom.disabled = zoom === 100;
        requestAnimationFrame(() => {
          canvas.scrollLeft = centerRatio * canvas.scrollWidth - canvas.clientWidth / 2;
        });
      };
      zoomOut.addEventListener('click', () => applyZoom(zoom - 25));
      resetZoom.addEventListener('click', () => applyZoom(100));
      zoomIn.addEventListener('click', () => applyZoom(zoom + 25));
      controls.hidden = false;
      applyZoom(100);
    })
    .catch((error) => {
      console.error(`Could not render diagram "${diagram.title}".`, error);
      canvas.replaceChildren(el('p', 'diagram-error', 'The diagram could not be rendered. Use the text version below.'));
      source.open = true;
    });
  return figure;
}

function updateHardcoreProgress(lesson) {
  if (learningMode !== 'hardcore' || !lesson.hardcore) {
    hardcoreProgressEl.hidden = true;
    return;
  }

  const progress = lessonProgress(lesson);
  const deepActivities =
    lesson.hardcore.deepDive?.phases.flatMap((phase) => phase.activities) ?? [];
  const total =
    lesson.steps.length +
    lesson.hardcore.checkpoints.length +
    lesson.hardcore.drills.length +
    deepActivities.length;
  const completed =
    progress.steps.filter(Boolean).length +
    progress.checkpoints.filter(Boolean).length +
    progress.drills.filter(Boolean).length +
    deepActivities.filter((activity) => progress.deep[activity.id]).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  hardcoreProgressEl.innerHTML = '';
  const label = el('div', 'progress-label');
  label.append(el('strong', null, `${percent}% mastery`));
  label.append(el('span', null, `${completed} of ${total} activities`));
  const bar = el('div', 'progress-track');
  const fill = el('span');
  fill.style.width = `${percent}%`;
  bar.append(fill);
  hardcoreProgressEl.append(label, bar);
  hardcoreProgressEl.hidden = false;
}

function appendMasteryCheck(container, lesson, group, index, label) {
  const progress = lessonProgress(lesson);
  const row = el('label', 'mastery-check');
  const checkbox = el('input');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(progress[group][index]);
  checkbox.addEventListener('change', () => {
    progress[group][index] = checkbox.checked;
    saveHardcoreProgress();
    updateHardcoreProgress(lesson);
  });
  row.append(checkbox, document.createTextNode(label));
  container.append(row);
}

function appendDeepMasteryCheck(container, lesson, activity) {
  const progress = lessonProgress(lesson);
  const row = el('label', 'mastery-check deep-mastery-check');
  const checkbox = el('input');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(progress.deep[activity.id]);
  checkbox.addEventListener('change', () => {
    progress.deep[activity.id] = checkbox.checked;
    saveHardcoreProgress();
    updateHardcoreProgress(lesson);
  });
  const firstEvidence = activity.evidence?.[0];
  const evidenceText = typeof firstEvidence === 'string'
    ? firstEvidence
    : firstEvidence?.item ?? 'the required evidence';
  row.append(
    checkbox,
    document.createTextNode(
      activity.type === 'assessment'
        ? 'I completed this closed-book and verified every required outcome'
        : `I completed this activity and recorded: ${evidenceText}`,
    ),
  );
  container.append(row);
}

function renderCheckpoint(lesson, checkpoint, index) {
  const alreadyComplete = Boolean(lessonProgress(lesson).checkpoints[index]);
  const card = el('article', 'checkpoint-card');
  card.append(el('div', 'eyebrow', `Retrieval check ${index + 1}`));
  card.append(el('h4', null, checkpoint.question));
  const options = el('div', 'checkpoint-options');
  const feedback = el('p', 'checkpoint-feedback');
  feedback.hidden = true;

  checkpoint.options.forEach((option, optionIndex) => {
    const button = el('button', 'answer-option', option);
    button.type = 'button';
    button.disabled = alreadyComplete;
    button.classList.toggle('correct', alreadyComplete && optionIndex === checkpoint.answer);
    button.addEventListener('click', () => {
      const correct = optionIndex === checkpoint.answer;
      for (const candidate of options.querySelectorAll('button')) {
        candidate.classList.remove('incorrect');
        if (correct) {
          candidate.disabled = true;
          candidate.classList.toggle('correct', Number(candidate.dataset.index) === checkpoint.answer);
        }
      }
      button.classList.toggle('incorrect', !correct);
      feedback.className = `checkpoint-feedback ${correct ? 'correct' : 'incorrect'}`;
      feedback.textContent = `${correct ? 'Correct.' : 'Not quite.'} ${checkpoint.explanation}`;
      feedback.hidden = false;
      if (correct) {
        lessonProgress(lesson).checkpoints[index] = true;
        saveHardcoreProgress();
        updateHardcoreProgress(lesson);
      }
    });
    button.dataset.index = optionIndex;
    options.append(button);
  });
  if (alreadyComplete) {
    feedback.className = 'checkpoint-feedback correct';
    feedback.textContent = `Mastered. ${checkpoint.explanation}`;
    feedback.hidden = false;
  }
  card.append(options, feedback);
  return card;
}

function renderDrill(lesson, drill, index) {
  const card = el('article', 'drill-card');
  card.append(el('div', 'eyebrow', `Deliberate practice ${index + 1}`));
  card.append(el('h4', null, drill.title));
  card.append(el('p', null, drill.prompt));
  card.append(el('div', 'success-criteria', `Success looks like: ${drill.success}`));

  const loadButton = el('button', null, 'Load starter SQL');
  loadButton.type = 'button';
  loadButton.addEventListener('click', () => {
    editor.value = drill.starterSql;
    editor.focus();
  });
  card.append(loadButton);
  appendDisclosure(card, 'Need a hint?', drill.hint, 'drill-help');

  const solution = el('details', 'drill-help solution');
  solution.append(el('summary', null, 'Compare with a reference solution'));
  solution.append(window.SqlGuide.render(drill.solution, `${drill.title} solution`, drill.prompt));
  const runSolution = el('button', 'ghost', 'Run reference solution');
  runSolution.type = 'button';
  runSolution.addEventListener('click', () => {
    editor.value = drill.solution;
    editor.focus();
    runSql(drill.solution);
  });
  solution.append(runSolution);
  card.append(solution);
  appendMasteryCheck(card, lesson, 'drills', index, 'I can complete and explain this without the solution');
  return card;
}

function activityChecksComplete(progress, activity) {
  const saved = progress.activityChecks[activity.id] ?? {};
  return activity.checks.every((check) => saved[check.id] === check.answer);
}

function renderActivityChecks(lesson, activity) {
  const progress = lessonProgress(lesson);
  if (!progress.activityChecks[activity.id] || typeof progress.activityChecks[activity.id] !== 'object') {
    progress.activityChecks[activity.id] = {};
  }
  const savedChecks = progress.activityChecks[activity.id];
  const legacyAnswer = progress.multipleChoice[activity.id];
  let progressChanged = false;
  if (
    activity.migrateLegacyMultipleChoice
    && legacyAnswer !== undefined
    && savedChecks[activity.checks[0].id] === undefined
  ) {
    savedChecks[activity.checks[0].id] = legacyAnswer;
    progressChanged = true;
  }

  const group = el('section', 'activity-check-group');
  activity.checks.forEach((check, checkIndex) => {
    const saved = savedChecks[check.id];
    const card = el('section', 'activity-check');
    card.append(el('div', 'eyebrow', `Concept check ${checkIndex + 1} of ${activity.checks.length}`));
    card.append(el('h5', null, check.question));
    const options = el('div', 'checkpoint-options');
    const feedback = el('p', 'checkpoint-feedback');
    feedback.setAttribute('aria-live', 'polite');
    feedback.hidden = saved === undefined;

    check.options.forEach((option, optionIndex) => {
      const button = el('button', 'answer-option', option);
      button.type = 'button';
      button.dataset.index = optionIndex;
      button.disabled = saved === check.answer;
      button.classList.toggle('correct', saved === check.answer && optionIndex === check.answer);
      button.classList.toggle('incorrect', saved !== undefined && saved !== check.answer && optionIndex === saved);
      button.addEventListener('click', () => {
        const correct = optionIndex === check.answer;
        for (const candidate of options.querySelectorAll('button')) {
          candidate.classList.remove('correct', 'incorrect');
          if (correct) {
            candidate.disabled = true;
            candidate.classList.toggle('correct', Number(candidate.dataset.index) === check.answer);
          }
        }
        button.classList.toggle('incorrect', !correct);
        feedback.className = `checkpoint-feedback ${correct ? 'correct' : 'incorrect'}`;
        feedback.textContent = correct
          ? `Correct. ${check.explanation}`
          : `Not quite. ${check.retryExplanations[optionIndex]}`;
        feedback.hidden = false;
        savedChecks[check.id] = optionIndex;
        progress.deep[activity.id] = activityChecksComplete(progress, activity);
        saveHardcoreProgress();
        updateHardcoreProgress(lesson);
        status.textContent = progress.deep[activity.id]
          ? 'All concept checks complete'
          : `${activity.checks.filter((candidate) => savedChecks[candidate.id] === candidate.answer).length} of ${activity.checks.length} checks complete`;
        status.classList.toggle('complete', progress.deep[activity.id]);
      });
      options.append(button);
    });

    if (saved !== undefined) {
      const correct = saved === check.answer;
      feedback.className = `checkpoint-feedback ${correct ? 'correct' : 'incorrect'}`;
      feedback.textContent = correct
        ? `Mastered. ${check.explanation}`
        : `Not quite. ${check.retryExplanations[saved]}`;
    }
    card.append(options, feedback);
    group.append(card);
  });

  const checksComplete = activityChecksComplete(progress, activity);
  if (progress.deep[activity.id] !== checksComplete) {
    progress.deep[activity.id] = checksComplete;
    progressChanged = true;
  }
  if (progressChanged) saveHardcoreProgress();
  const completeCount = activity.checks.filter((check) => savedChecks[check.id] === check.answer).length;
  const status = el(
    'p',
    `activity-check-status${progress.deep[activity.id] ? ' complete' : ''}`,
    progress.deep[activity.id]
      ? 'All concept checks complete'
      : `${completeCount} of ${activity.checks.length} checks complete`,
  );
  group.append(status);
  return group;
}

function renderHardcoreIntro(container, lesson) {
  const hardcore = lesson.hardcore;
  const intro = el('section', 'hardcore-intro');
  const heading = el('div', 'hardcore-heading');
  heading.append(el('span', 'hardcore-badge', 'HARDCORE'));
  heading.append(el('span', 'duration', `${lesson.duration} standard · ${hardcore.duration} hardcore`));
  intro.append(heading);
  intro.append(el('h3', null, 'Build a mental model, not muscle memory'));
  intro.append(el('p', null, hardcore.mentalModel));
  intro.append(el('h4', null, 'Before you begin'));
  appendList(intro, 'hardcore-list', hardcore.prerequisites);
  appendDisclosure(
    intro,
    'The hardcore learning loop',
    'Predict before running. Execute and inspect the real result. Change one variable. Explain the result from memory. Mark mastery only when you can reproduce it without the reference.',
    'learning-loop',
  );
  container.append(intro);
}

function appendSqlAction(container, sql, label, shouldRun = false) {
  const button = el('button', shouldRun ? null : 'ghost', label);
  button.type = 'button';
  button.addEventListener('click', () => {
    editor.value = sql;
    editor.focus();
    if (shouldRun) runSql(sql);
  });
  container.append(button);
}

function renderDeepActivity(lesson, activity, sourceIndex) {
  const card = el('article', `deep-activity activity-${activity.type}`);
  const heading = el('div', 'deep-activity-heading');
  heading.append(el('span', 'activity-type', activity.type.replaceAll('-', ' ')));
  heading.append(el('span', `claim-kind claim-${activity.claim}`, activity.claim));
  card.append(heading);
  card.append(el('h4', null, activity.title));
  const tutorButton = el('button', 'ghost', 'Ask tutor about this activity');
  tutorButton.type = 'button';
  tutorButton.addEventListener('click', () =>
    openTutor(lesson, { kind: 'hardcore', activityId: activity.id, label: activity.title }),
  );
  card.append(tutorButton);
  card.append(el('p', 'activity-purpose', activity.goal));
  appendDisclosure(card, 'Why this matters', activity.whyItMatters, 'activity-why');
  if (activity.prerequisites?.length) {
    card.append(el('h5', null, 'Before you begin'));
    appendList(card, 'activity-prerequisites', activity.prerequisites);
  }
  if (activity.vocabulary?.length) {
    const vocabulary = el('details', 'activity-vocabulary');
    vocabulary.append(el('summary', null, 'Words to know'));
    for (const word of activity.vocabulary) {
      const definition = el('p');
      definition.append(el('strong', null, `${word.term}: `));
      definition.append(document.createTextNode(`${word.simpleMeaning} ${word.technicalMeaning}`));
      if (word.example) definition.append(el('code', null, ` Example: ${word.example}`));
      vocabulary.append(definition);
    }
    card.append(vocabulary);
  }

  const instructions = el('ol', 'activity-instructions');
  for (const step of activity.steps ?? []) {
    const item = el('li');
    item.append(el('strong', null, step.action));
    item.append(el('p', null, `Why: ${step.reason}`));
    item.append(el('p', 'expected-result', `Expected result: ${step.expectedResult} ${step.explanation}`));
    item.append(el('p', 'troubleshooting', `If it differs: ${step.troubleshooting}`));
    instructions.append(item);
  }
  card.append(instructions);

  if (activity.diagram) card.append(renderDiagram(activity.diagram));
  if (!activity.sql && !activity.starterSql && activity.checks?.length) {
    card.append(renderActivityChecks(lesson, activity));
  }

  if (activity.sql) {
    const insights = Object.fromEntries(
      (activity.sqlWalkthrough ?? []).map((entry) => [
        entry.fragment,
        { title: entry.fragment, what: entry.explanation, why: entry.lessonConnection },
      ]),
    );
    card.append(window.SqlGuide.render(activity.sql, activity.title, activity.goal, insights));
    appendSqlAction(card, activity.sql, 'Load lab SQL');
  }
  if (activity.starterSql) {
    appendSqlAction(card, activity.starterSql, 'Load starter SQL');
  }
  if (activity.hints?.length) {
    const hints = el('details', 'drill-help');
    hints.append(el('summary', null, 'Progressive hints'));
    for (const hint of activity.hints) hints.append(el('p', null, `Hint ${hint.level}: ${hint.text}`));
    card.append(hints);
  } else if (activity.hint) appendDisclosure(card, 'Progressive hint', activity.hint, 'drill-help');
  if (activity.solution) {
    const solution = el('details', 'drill-help solution');
    solution.append(el('summary', null, 'Reveal reference approach'));
    solution.append(
      window.SqlGuide.render(activity.solution, `${activity.title} reference`, activity.purpose),
    );
    appendSqlAction(solution, activity.solution, 'Run reference', true);
    card.append(solution);
  }
  if (activity.workedAnswer) {
    const answer = el('details', 'drill-help solution');
    answer.append(el('summary', null, 'Reveal worked answer'));
    answer.append(el('p', null, activity.workedAnswer.answer));
    answer.append(el('p', null, activity.workedAnswer.explanation));
    if (activity.workedAnswer.template) answer.append(el('p', null, `Template: ${activity.workedAnswer.template}`));
    if (activity.workedAnswer.example) answer.append(el('p', null, `Example: ${activity.workedAnswer.example}`));
    appendList(answer, 'activity-prerequisites', activity.workedAnswer.acceptableVariations ?? []);
    card.append(answer);
  }
  if (activity.commonMistakes?.length) {
    const mistakes = el('details', 'drill-help');
    mistakes.append(el('summary', null, 'Common mistakes and recovery'));
    for (const mistake of activity.commonMistakes) {
      mistakes.append(el('p', null, `${mistake.symptom} Cause: ${mistake.cause} Fix: ${mistake.fix}`));
    }
    card.append(mistakes);
  }

  const evidence = el('div', 'evidence-box');
  evidence.append(el('strong', null, 'Evidence to record'));
  appendList(evidence, 'evidence-list', activity.evidence);
  card.append(evidence);

  if (activity.sourceIds?.length) {
    const sources = el('p', 'activity-sources');
    sources.append(document.createTextNode('Read this exact part: '));
    activity.sourceIds.forEach((sourceId, index) => {
      const source = sourceIndex.get(sourceId);
      if (!source) return;
      const link = el('a', null, source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      sources.append(link);
      if (source.locator?.heading) {
        sources.append(document.createTextNode(` (${source.locator.heading}${source.locator.subheading ? ` → ${source.locator.subheading}` : ''})`));
      }
      if (index < activity.sourceIds.length - 1) {
        sources.append(document.createTextNode(' · '));
      }
    });
    card.append(sources);
  }

  if (activity.sql || activity.starterSql) {
    appendDeepMasteryCheck(card, lesson, activity);
  }
  return card;
}

function renderDeepCurriculum(container, lesson) {
  const deepDive = lesson.hardcore.deepDive;
  if (!deepDive) return;

  const sourceIndex = new Map(deepDive.sources.map((source) => [source.id, source]));
  const overview = el('section', 'deep-overview');
  overview.append(el('div', 'eyebrow', 'Estimated guided practice'));
  overview.append(el('h3', null, deepDive.title));
  overview.append(el('p', null, deepDive.summary));
  overview.append(el('h4', null, 'Mastery outcomes'));
  appendList(overview, 'hardcore-list', deepDive.outcomes);
  const time = deepDive.phases.reduce((total, phase) => total + phase.minutes, 0);
  overview.append(
    el(
      'p',
      'time-budget',
      `${deepDive.phases.length} phases · ${deepDive.phases.flatMap((phase) => phase.activities).length} activities · about ${time} minutes (estimate, not a deadline)`,
    ),
  );
  container.append(overview);

  deepDive.phases.forEach((phase, phaseIndex) => {
    const section = el('details', 'deep-phase');
    section.open = phaseIndex === 0;
    const summary = el('summary');
    const summaryText = el('span');
    summaryText.append(el('b', null, `${phaseIndex + 1}. ${phase.title}`));
    summaryText.append(el('small', null, phase.overview));
    summary.append(summaryText, el('span', 'phase-time', `${phase.minutes} min`));
    section.append(summary);
    const body = el('div', 'deep-phase-body');
    for (const activity of phase.activities) {
      body.append(renderDeepActivity(lesson, activity, sourceIndex));
    }
    section.append(body);
    container.append(section);
  });

  const sources = el('section', 'source-panel');
  sources.append(el('h3', null, 'Verified source map'));
  sources.append(
    el(
      'p',
      'section-intro',
      'Documented facts link to primary references. Measured claims must be reproduced in this lab; recommendations must be defended against workload constraints.',
    ),
  );
  const list = el('ol', 'source-list');
  for (const source of deepDive.sources) {
    const item = el('li');
    const link = el('a', null, source.title);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    item.append(link);
    item.append(document.createTextNode(` — ${source.readFor ?? source.note ?? source.relevantSummary}`));
    if (source.locator?.heading) item.append(el('small', null, ` Read: ${source.locator.heading}${source.locator.subheading ? ` → ${source.locator.subheading}` : ''}.`));
    list.append(item);
  }
  sources.append(list);
  container.append(sources);
}

function renderLesson(lesson) {
  const container = $('#lesson');
  container.innerHTML = '';
  container.append(el('h2', null, `${lesson.id} · ${lesson.title}`));
  container.append(el('p', 'summary', lesson.summary));

  if (lesson.objectives.length) {
    const list = el('ul', 'objectives');
    for (const objective of lesson.objectives) list.append(el('li', null, objective));
    container.append(list);
  }

  const hardcoreEnabled = learningMode === 'hardcore' && lesson.hardcore;
  if (hardcoreEnabled) renderHardcoreIntro(container, lesson);
  if (hardcoreEnabled) renderDeepCurriculum(container, lesson);

  lesson.steps.forEach((step, index) => {
    const wrapper = el('div', 'step');
    wrapper.append(el('h3', null, `${index + 1}. ${step.title}`));
    if (hardcoreEnabled) {
      appendDisclosure(
        wrapper,
        'Predict before you run',
        'Without executing the SQL, describe what will change, what shape the result will have, and which database feature does the work.',
        'prediction',
      );
    }
    if (step.explain) wrapper.append(el('p', null, step.explain));
    if (step.analogy) wrapper.append(renderDiagram(step.analogy, 'analogy'));
    if (step.diagram) wrapper.append(renderDiagram(step.diagram));
    if (step.sql) {
      wrapper.append(window.SqlGuide.render(step.sql, step.title, step.explain));
      const button = el('button', 'ghost', 'Load into editor');
      button.addEventListener('click', () => {
        editor.value = step.sql;
        editor.focus();
        runSql(step.sql);
      });
      wrapper.append(button);
    }
    const tutorButton = el('button', 'ghost', 'Ask AI');
    tutorButton.disabled = !aiAvailable;
    tutorButton.title = aiAvailable ? 'Ask the tutor about this example' : 'Configure OPENAI_API_KEY to enable AI tutoring';
    tutorButton.addEventListener('click', () =>
      openTutor(lesson, { kind: 'step', stepIndex: index, label: `Example ${index + 1}: ${step.title}` }),
    );
    wrapper.append(tutorButton);
    if (step.takeaway) wrapper.append(el('div', 'aside-take', `Takeaway: ${step.takeaway}`));
    if (step.note) wrapper.append(el('div', 'aside-note', `Note: ${step.note}`));
    if (hardcoreEnabled) {
      appendDisclosure(
        wrapper,
        'Make it stick',
        'Change one safe input such as a time window, grouping column, threshold, or LIMIT. Predict the difference, run it, then explain why the output or plan changed.',
        'make-it-stick',
      );
      appendMasteryCheck(wrapper, lesson, 'steps', index, 'I predicted, experimented, and can explain this step');
    }
    container.append(wrapper);
  });

  if (hardcoreEnabled) {
    const checks = el('section', 'hardcore-section');
    checks.append(el('h3', null, 'Closed-book retrieval'));
    checks.append(
      el(
        'p',
        'section-intro',
        'Answer from memory. A missed answer is useful: revisit the relevant step, then try again after a short break.',
      ),
    );
    lesson.hardcore.checkpoints.forEach((checkpoint, index) =>
      checks.append(renderCheckpoint(lesson, checkpoint, index)),
    );
    container.append(checks);

    const drills = el('section', 'hardcore-section');
    drills.append(el('h3', null, 'Deliberate practice'));
    drills.append(
      el(
        'p',
        'section-intro',
        'Start from the incomplete SQL, verify the stated outcome, and only then compare your approach.',
      ),
    );
    lesson.hardcore.drills.forEach((drill, index) => drills.append(renderDrill(lesson, drill, index)));
    container.append(drills);

    const pitfalls = el('section', 'pitfall-panel');
    pitfalls.append(el('h3', null, 'Failure modes to recognize'));
    appendList(pitfalls, 'hardcore-list', lesson.hardcore.pitfalls);
    container.append(pitfalls);
  }

  if (lesson.challenge) {
    const wrapper = el('div', 'step');
    wrapper.append(el('h3', null, hardcoreEnabled ? 'Final transfer challenge' : 'Challenge'));
    wrapper.append(el('p', null, lesson.challenge.prompt));
    if (lesson.challenge.hint) wrapper.append(el('div', 'aside-note', `Hint: ${lesson.challenge.hint}`));
    const tutorButton = el('button', 'ghost', 'Ask AI for a hint');
    tutorButton.disabled = !aiAvailable;
    tutorButton.title = aiAvailable ? 'Ask the tutor about this challenge' : 'Configure OPENAI_API_KEY to enable AI tutoring';
    tutorButton.addEventListener('click', () => openTutor(lesson, { kind: 'challenge', label: 'Challenge' }));
    wrapper.append(tutorButton);
    container.append(wrapper);
  }
  updateHardcoreProgress(lesson);
  container.scrollTop = 0;
}

async function loadSchema() {
  try {
    const data = await fetch('/api/schema').then((r) => r.json());
    const nav = $('#schema');
    nav.innerHTML = '';

    const group = (label, items) => {
      if (!items.length) return;
      const wrap = el('span');
      wrap.append(el('b', null, `${label}: `));
      items.forEach((item, index) => {
        const code = el('code', null, item.name + (item.chunks ? ` (${item.chunks})` : ''));
        code.title = `SELECT * FROM ${item.name} LIMIT 20;`;
        code.addEventListener('click', () => {
          const sql = `SELECT * FROM ${item.name} LIMIT 20;`;
          editor.value = sql;
          runSql(sql);
        });
        wrap.append(code);
        if (index < items.length - 1) wrap.append(document.createTextNode(' '));
      });
      nav.append(wrap);
    };

    group('hypertables', data.hypertables);
    group('aggregates', data.continuousAggregates);
  } catch {
    /* schema strip is decorative; ignore failures */
  }
}

async function init() {
  const [lessonResponse, aiResponse] = await Promise.all([fetch('/api/lessons'), fetch('/api/ai/status')]);
  lessons = await lessonResponse.json();
  const aiStatus = await aiResponse.json();
  aiAvailable = aiStatus.available;
  const select = $('#module-select');
  learningModeSelect.value = learningMode;
  for (const lesson of lessons) {
    const option = el('option', null, `${lesson.id} · ${lesson.title}`);
    option.value = lesson.id;
    select.append(option);
  }
  select.addEventListener('change', () => {
    renderLesson(lessons.find((l) => l.id === select.value));
    tutorEl.hidden = true;
    activeTutor = null;
  });
  learningModeSelect.addEventListener('change', () => {
    learningMode = learningModeSelect.value;
    saveLearningMode();
    renderLesson(lessons.find((lesson) => lesson.id === select.value));
    tutorEl.hidden = true;
    activeTutor = null;
  });
  if (lessons.length) renderLesson(lessons[0]);

  $('#run').addEventListener('click', () => runSql(editor.value));
  for (const surface of [$('#lesson'), resultEl]) {
    surface.addEventListener('pointerover', (event) => {
      const token = event.target.closest('.sql-token');
      if (token) showSqlInsight(token);
    });
    surface.addEventListener('pointerout', (event) => {
      if (event.target.closest('.sql-token')) hideSqlInsight();
    });
    surface.addEventListener('focusin', (event) => {
      const token = event.target.closest('.sql-token');
      if (token) showSqlInsight(token);
    });
    surface.addEventListener('focusout', (event) => {
      if (event.target.closest('.sql-token')) hideSqlInsight();
    });
  }
  tutorForm.addEventListener('submit', sendTutorMessage);
  tutorInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      tutorForm.requestSubmit();
    }
  });
  $('#close-tutor').addEventListener('click', () => {
    tutorEl.hidden = true;
    activeTutor = null;
  });
  $('#explain').addEventListener('click', () => {
    const sql = editor.value.trim().replace(/;\s*$/, '');
    if (!sql) return;
    // Don't stack EXPLAIN on a statement that already has one.
    runSql(/^explain/i.test(sql) ? sql : `EXPLAIN (ANALYZE, BUFFERS) ${sql}`);
  });
  editor.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runSql(editor.value);
    }
  });

  await loadSchema();
}

init();
