# Hardcore Mode Redesign Plan

## Purpose

Redesign Hardcore Mode so that it is detailed rather than merely difficult.
Every required activity should guide a beginner through one small action at a
time, explain every new idea in child-friendly language, provide useful hints
and answers, and point to the exact part of each external reference that matters.

This document is an implementation plan only. Query execution failures belong
to the separate workstream described near the end of this plan.

## Problems found in the current implementation

### The tests reward quantity instead of teaching quality

The current Hardcore Mode test requires:

- 8 or more phases per lesson
- 10 or more activities per lesson
- 120 to 240 estimated minutes per lesson
- only 2 instruction strings and 1 evidence string per activity

These rules encourage long lessons, but they do not prove that a learner knows
what to do. Replace these requirements with checks for usable instructions,
expected results, explanations, hints, answers, and exact source references.

Relevant file:

- `test/hardcore.test.mjs`

### The time estimates are artificial

The short durations initially assigned in `src/hardcore.mjs` are overwritten by
the deep curriculum. Core and advanced lessons use repeated time templates, so
an activity can claim to take 20 or 30 minutes even when it contains only two
vague instructions.

Relevant files:

- `src/hardcore.mjs`
- `src/hardcore-curriculum-core.mjs`
- `src/hardcore-curriculum-advanced.mjs`

### Many activities do not provide enough help

Each lesson has several deep activities with no runnable SQL, starter content,
structured worksheet, or worked answer. Many activities ask the learner to
perform advanced work such as writing an incident handoff, deriving equations,
defending an architecture, or producing an evidence ladder without first
explaining those outputs.

### The content model is too shallow

Activities currently store instructions and evidence as arrays of strings.
There is no required place for:

- simple definitions
- the reason for each step
- expected output
- explanations of the output
- line-by-line SQL guidance
- common mistakes
- recovery steps
- progressive hints
- worked answers
- acceptable answer variations

### References are too broad

Many links point to an entire documentation area. The UI displays a source
title but does not tell the learner which heading, paragraph, table, example,
or API signature to read.

Relevant file:

- `src/web/public/app.js`

### Highlighted SQL explanations are often too generic

The SQL guide contains many useful definitions, but a generic explanation such
as "`WHERE` filters rows" does not explain what `WHERE` does in the current
query or why the learner needs it.

Relevant file:

- `src/web/public/sql-guide.js`

### Answers are inconsistent

The smaller drills usually contain starter SQL, a hint, a solution, and success
criteria. Deep activities often contain only an abstract instruction and an
evidence request. Closed-book activities describe what an answer should contain
without consistently showing the learner a complete answer afterward.

### Hardcore activities are not first-class AI tutor subjects

The tutor receives standard lesson-step or challenge context. It does not
receive the selected Hardcore activity, its current microstep, vocabulary,
expected result, hints, or reference summary.

Relevant file:

- `src/web/server.mjs`

### Browser behavior is not directly tested

The current Hardcore test validates curriculum objects, but it does not prove
that microsteps, answers, references, hints, or contextual highlights render
correctly in the browser.

## Target learner contract

Every required Hardcore activity must answer all of these questions:

1. What am I learning?
2. Why does it matter?
3. What must I know before I begin?
4. What do unfamiliar words mean?
5. What is the first small action?
6. Why am I taking that action?
7. What should I see after taking it?
8. What does that result mean?
9. What should I do if my result is different?
10. What is the next small action?
11. What is a correct final answer?
12. How can I prove that I completed the activity correctly?

### Language rules

- Use short sentences.
- Introduce one new idea at a time.
- Define technical terms before relying on them.
- Give a familiar analogy first when it helps.
- Follow the analogy with the correct technical definition.
- Keep correct PostgreSQL, TimescaleDB, and Toolkit terminology.
- Do not use advanced phrases without defining them.
- Write for an attentive 8- to 12-year-old who is new to databases.

For every necessary technical term, provide:

1. A simple meaning.
2. The technical meaning.
3. A small example.
4. An explanation of why it matters in this activity.

### Microstep rule

An instruction such as "analyze the plan" is not acceptable. It should be
split into actions such as:

1. Load the supplied query.
2. Do not run it yet.
3. Find the `WHERE` line.
4. Find the time condition on that line.
5. Predict how much history the query can read.
6. Run the query with `EXPLAIN`.
7. Find the deepest scan node.
8. Record its `actual rows` value.
9. Count the chunks named in the plan.
10. Compare that number with the total number of chunks.
11. Read the supplied explanation.
12. Write one sentence explaining why some chunks were skipped.

### Progressive-help rule

Each activity should offer four levels of help:

1. A small nudge toward the next action.
2. A stronger conceptual hint.
3. A partially completed answer or structure.
4. A complete worked answer with an explanation.

The learner should never reach a dead end with only "record evidence" as the
remaining instruction.

## Workstream A: rebuild the curriculum data model

### HC-01: Define a complete activity schema

Files:

- `src/hardcore.mjs`
- `src/hardcore-curriculum-core.mjs`
- `src/hardcore-curriculum-advanced.mjs`

Dependencies: none.

Introduce a consistent activity shape that can represent:

```js
{
  id,
  type,
  required,
  title,
  estimatedMinutes: {
    minimum,
    typical,
    maximum
  },
  goal,
  whyItMatters,
  prerequisites: [],
  vocabulary: [
    {
      term,
      simpleMeaning,
      technicalMeaning,
      example
    }
  ],
  beforeYouRun: {
    predictionQuestion,
    predictionChoices,
    explanation
  },
  steps: [
    {
      action,
      reason,
      expectedResult,
      explanation,
      troubleshooting
    }
  ],
  sql,
  sqlWalkthrough: [
    {
      fragment,
      explanation,
      lessonConnection
    }
  ],
  hints: [
    { level: 1, text },
    { level: 2, text },
    { level: 3, text }
  ],
  workedAnswer: {
    answer,
    explanation,
    acceptableVariations
  },
  evidence: [
    {
      item,
      example,
      completionCheck
    }
  ],
  commonMistakes: [
    {
      symptom,
      cause,
      fix
    }
  ],
  sourceRefs: []
}
```

Acceptance criteria:

- Every required activity has a worked answer.
- Every executable activity explains its expected output.
- Every writing activity supplies a template and an example response.
- Every technical term is already known or defined locally.
- Activity IDs remain stable where possible so existing progress is preserved.
- Optional extensions are explicitly marked and do not block completion.

### HC-02: Define an exact reference schema

Dependencies: HC-01.

Replace broad source notes with activity-specific reference locators:

```js
{
  sourceId,
  url,
  documentTitle,
  locator: {
    heading,
    subheading,
    anchor,
    searchPhrase
  },
  readFor,
  relevantSummary,
  shortExcerpt,
  lastVerified
}
```

Rules:

1. Prefer a stable URL containing an exact anchor.
2. Name the heading and subheading.
3. Include a distinctive search phrase when no stable anchor exists.
4. Explain what fact the learner should obtain from the source.
5. If the source has no useful locator, add a self-contained paraphrase.
6. Use only a short quotation when a quotation is necessary to identify a rule.
7. Do not copy large portions of third-party documentation.
8. Map each activity only to the exact sources that support it.
9. Record when the source was last checked.
10. Record version limits for version-sensitive behavior.

Example presentation:

> Read this part: "Hypertables and chunks" -> "Chunks" -> the paragraph
> beginning "Chunks are created automatically..."
>
> Look for: how rows are placed into time ranges.
>
> In simple words: TimescaleDB puts rows from nearby times into the same
> smaller storage box.

Acceptance criteria:

- Every documented claim has an exact locator or a self-contained explanation.
- A learner can reach the relevant material in no more than two navigation
  actions after opening the link.
- Every source explains why the learner should read it.
- Broken and redirected links are reported by validation.

### HC-03: Replace volume checks with a content-quality linter

Files:

- `test/hardcore.test.mjs`
- a new focused validation module if keeping all checks in one test becomes
  difficult to maintain

Dependencies: HC-01 and HC-02.

Remove:

- the minimum of 8 phases
- the minimum of 10 activities
- the forced 120-to-240-minute duration
- any rule that requires identical activity categories in every lesson

Add checks for:

- a goal and reason
- defined vocabulary
- ordered microsteps
- a reason for important actions
- an expected result
- a result explanation
- troubleshooting guidance
- progressive hints
- a worked answer
- a concrete completion check
- runnable SQL or an explicit query-construction sequence
- complete solutions for starter SQL
- templates and examples for writing activities
- answer keys for assessments
- exact source headings, anchors, or search phrases
- valid source references
- unique source and activity IDs
- internally consistent time ranges
- lesson totals derived from required activity time

Add a check that rejects vague standalone instructions such as:

- analyze this
- defend your answer
- record evidence
- explain the result
- choose the best design

These phrases may be used only when the activity also names the exact object,
method, output format, and completion rule.

Automated tests cannot fully judge child-friendly writing. Add a human-review
checklist covering:

- sentence clarity
- jargon definitions
- technical correctness
- usefulness of examples
- completeness of worked answers
- agreement between expected output and the seeded dataset

## Workstream B: rebuild the learner interface

### UI-01: Render guided activity stages

File:

- `src/web/public/app.js`

Dependencies: HC-01 and HC-02.

Render each activity in this order:

1. What you will learn.
2. Why it matters.
3. What you need before starting.
4. Words to know.
5. Prediction.
6. One microstep at a time.
7. Expected result after each important step.
8. Explanation of what happened.
9. Progressive hints.
10. Worked answer.
11. Common mistakes and recovery.
12. Exact reference locator.
13. Completion checklist.

Behavior requirements:

- Keep worked answers hidden initially.
- Reveal help progressively.
- Put each action button beside the step that describes it.
- Separate expected output from the final answer.
- Display required and optional activities differently.
- Preserve progress using stable activity IDs.
- Name the exact evidence in the completion control.
- Replace the fixed "2-4 hour engineering intensive" label.
- Display realistic activity time ranges and a calculated lesson total.
- Keep the interface keyboard- and screen-reader-accessible.

### UI-02: Make SQL highlighting contextual

File:

- `src/web/public/sql-guide.js`

Dependency: HC-01.

Use this explanation priority:

1. Explanation supplied for this exact SQL fragment by the activity.
2. Lesson-specific explanation.
3. Schema-aware explanation.
4. Generic SQL definition.

Every useful highlight should answer:

- What does this token mean?
- What does it do in this exact query?
- Why is it needed here?
- What changes if it is removed or changed?
- Which result column or query-plan behavior does it affect?

Example:

Generic text:

> `WHERE` filters rows.

Preferred contextual text:

> `WHERE` keeps only sensor 7's rows from the last six hours. Without this
> line, PostgreSQL would consider every sensor and the full seeded time range.

Audit these highlight categories:

- SQL keywords
- TimescaleDB functions
- Toolkit functions
- table names
- column names
- interval literals
- operators
- aliases
- query-plan terms

### UI-03: Add Hardcore activity context to the AI tutor

Files:

- `src/web/server.mjs`
- `src/web/public/app.js`

Dependencies: HC-01 and UI-01.

Supply the tutor with:

- lesson title
- activity goal
- current microstep
- vocabulary
- SQL
- expected result
- available hints
- common mistakes
- relevant source summaries

Tutor rules:

- Explain one step at a time.
- Use the same child-friendly vocabulary as the curriculum.
- Do not invent database results.
- Ask the learner what output they received.
- Prefer the next hint before showing a complete answer.
- Show the worked answer when the learner explicitly requests it.

### UI-04: Add browser rendering tests

Dependencies: UI-01, UI-02, and UI-03.

Test that:

- microsteps render in order
- expected results render
- hint levels reveal progressively
- worked answers remain hidden initially
- exact reference locators are visible
- contextual explanations override generic token definitions
- completion controls name concrete evidence
- time ranges and lesson totals render correctly
- existing progress continues to map to stable IDs
- optional activities do not block required completion

## Workstream C: rewrite the curriculum

Do not rewrite all lessons simultaneously. Complete lesson 00 as the pilot,
review it with a novice, improve the schema and UI, and only then migrate the
remaining lessons.

### CUR-00: Setup and orientation pilot

Dependencies: HC-01, HC-02, HC-03, and UI-01.

Teach:

1. What PostgreSQL is.
2. What an extension is.
3. The difference between PostgreSQL's version and TimescaleDB's version.
4. What a database connection identifies.
5. What a table is.
6. What a hypertable adds.
7. What a system catalog is.
8. How to run the connection fingerprint query.
9. What every selected column means.
10. What shape the output should have.
11. What different outputs mean.
12. How to diagnose the wrong database.
13. How to write a five-line incident handoff.
14. A complete example incident handoff.
15. A complete answer key for the retrieval exercise.

Pilot exit criteria:

- A novice can finish the lesson without outside help.
- Every query has an expected output shape.
- Every writing activity has a template and example.
- Every reference has an exact locator.
- A reviewer confirms that the language is understandable without prior
  database-operations experience.
- A measured estimate replaces the artificial three-hour duration.

### CUR-01: Hypertables and chunks

- Explain chunks as time-range storage boxes before using the technical term.
- Explain `[start, end)` with a number line.
- Show where a timestamp exactly on a boundary belongs.
- Define chunk pruning before showing an execution plan.
- Supply a fixed plan-reading checklist.
- Supply a chunk-sizing worksheet with definitions and one completed example.
- Label sizing recommendations as workload-dependent.
- Include answers for boundary, plan, and sizing activities.

### CUR-02: Write and query

- Use a tiny row set before using the full seeded dataset.
- Explain `time_bucket` with clock examples.
- Compare `min(value)` with `first(value, time)` using concrete rows.
- Explain why physical row order is not a safe definition of "latest."
- Build `DISTINCT ON` one clause at a time.
- Explain the hypertable unique-index rule with a partitioned-box example.
- Provide complete answers for latest-row, bucket-shift, and idempotent-write
  activities.

### CUR-03: Continuous aggregates

- Define raw rows, saved summaries, refresh windows, and real-time results
  separately.
- Use one timeline for watermarks and refresh boundaries.
- Show how to locate and read a watermark before asking the learner to reason
  from it.
- Provide a table showing materialized data, raw data, and real-time
  combination behavior.
- Turn missing-newest-bucket debugging into ordered checks.
- Supply exact answers for policy-window activities.

### CUR-04: Hypercore columnstore

- Explain rowstore and columnstore using a simple card or file analogy.
- Define `segmentby` and `orderby` with a tiny row set.
- Show good and bad segment choices.
- Explain conversion state separately from policy state.
- Do not claim size or speed improvements before measuring them.
- Supply a measurement worksheet and a filled example.
- Include recovery steps for every state-changing experiment.

### CUR-05: Jobs, policies, and retention

- Define a background job as a scheduled database task.
- Teach one policy at a time.
- Draw a timeline for refresh, columnstore, and retention order.
- Explain destructive retention behavior before providing commands.
- Separate last-run status, next-run time, and scheduler state.
- Convert stopped-job triage into a decision tree.
- Provide an accidental-data-loss response template and example.

### CUR-06: Hyperfunctions

- Introduce two-step aggregation with a summary-box analogy.
- Explain gaps, `NULL`, LOCF, and interpolation separately.
- Use a tiny counter-reset dataset before the fleet data.
- Show why `max - min` fails when a counter resets.
- Explain time weighting with unevenly spaced readings.
- Label results as exact, approximate, or dependent on assumptions.
- Supply answer keys for state, accessor, and rollup activities.

### CUR-07: Performance optimization

- Define plan, estimate, actual row, loop, buffer, index, and chunk pruning.
- Give the learner a fixed order for reading a plan.
- Explain why one faster run is not proof.
- Supply a worksheet for comparable measurements.
- Explain selectivity using small sets.
- Separate PostgreSQL indexes from chunk-skipping metadata.
- Replace open-ended slow-query diagnosis with a decision tree and example.

### CUR-08: Capstone

- Supply a design-record template instead of requesting an unstructured
  architecture document.
- Include requirement, data flow, raw-data lifetime, aggregate lifetime,
  refresh window, columnstore timing, risks, and verification query.
- Complete one section at a time.
- Include one fully worked design.
- Convert the closed-book defense into small questions with answers.
- Make every correctness rule observable and testable.

### CUR-09: Index toolbox

- Teach filtering, ordering, covering, JSON lookup, and broad scanning
  separately.
- Define heap, visibility map, operator, and operator class.
- Show why an index-only scan can still visit the heap.
- Include a JSON operator support table in the lesson.
- Split the five-index classification task into five answered scenarios.
- Provide an index-change template with success and rollback criteria.

### CUR-10: Roaring bitmaps

- Treat extension availability as a prerequisite gate.
- Explain mathematical sets with familiar objects before bitmaps.
- Define union, intersection, and difference with small lists.
- Supply an exact installed-function discovery sequence.
- Do not ask the learner to infer undocumented extension APIs.
- Explain retention equations with a tiny two-day example.
- Give complete SQL and a plain-language answer for adjacent-day retention.
- Add exact locators for the GitHub and PGXN references.

### CUR-11: Backfill and invalidation

- Define late data, invalidation, refresh, watermark, and policy window
  separately.
- Use one timestamped timeline throughout the lesson.
- Separate recent raw data from stale historical materialization.
- Explain why real-time mode does not repair old materialized ranges.
- Provide formulas and completed examples for aligned refresh bounds.
- Turn the freshness objective into a template with a complete example.

### CUR-12: Schema and cardinality

- Define wide table, narrow table, dimension table, cardinality, fanout, and
  skew.
- Use small diagrams before catalog queries.
- Explain why a nearly unique segment key creates poor groups.
- Label unsupported thresholds as experiment inputs rather than facts.
- Decompose schema choice into requirements and trade-offs.
- Supply answers for the comparison and migration scorecard.

### CUR-13: Analytics Toolkit

- Teach LTTB, `state_agg`, `heartbeat_agg`, and time-weighted integration in
  separate mini-lessons.
- Explain approximation without promising an exact returned point count.
- Separate explicit state events from inferred liveness.
- State observation-window and edge assumptions.
- Build a plain-SQL oracle before each specialized aggregate.
- Use tiny hand-checkable datasets and expected answers.
- Add a decision table showing which tool answers which question.

### CUR-14: Reading query plans

- Begin with a three-node plan.
- Teach tree direction, rows, loops, estimates, actuals, timing, and buffers
  separately.
- Explain inclusive node time before self-time reasoning.
- Supply a plan-annotation worksheet.
- Show the estimate-error formula and one completed calculation.
- Explain warm-cache comparisons and their limits.
- Replace "write the evidence ladder" with an ordered diagnostic procedure and
  a worked example.

## Workstream D: standardize answer types

### CUR-ANS: Define requirements for every answer format

Dependency: approval of the lesson 00 pilot.

#### SQL activities must include

- runnable starter SQL
- an explanation of what is intentionally missing
- progressive hints
- reference SQL
- expected columns
- expected row shape or invariant
- explanations of important clauses
- acceptable alternative SQL
- known database or extension version differences

#### Observation activities must include

- the exact value or field to find
- where it appears
- an example observation
- an interpretation guide
- recovery steps when the value is absent

#### Written explanations must include

- a sentence template
- required vocabulary
- an example answer
- acceptable variations
- an incorrect example and why it is incorrect

#### Diagrams and timelines must include

- a blank structure
- labels to place
- a completed example
- an explanation of the completed answer

#### Design recommendations must include

- supplied facts
- assumptions that must be stated
- a decision table
- an example recommendation
- an example rejection
- evidence required before production use

#### Assessments must include

- an answer key
- reasoning
- a link back to the teaching step
- an explanation of why each wrong choice is wrong

## Workstream E: correct time estimates

### TIME-01: Replace artificial phase durations

Dependency: completion of each rewritten lesson.

For every activity:

1. Count the required learner actions.
2. Separate reading, execution, observation, and writing time.
3. Conduct at least one novice walkthrough.
4. Record the actual completion time.
5. Use a range when learner speed can reasonably differ.
6. Mark optional exploration separately.
7. Calculate the lesson total from required activities.

Acceptance criteria:

- No phase receives a duration solely because a shared template says 20 or 25
  minutes.
- No lesson is forced to last at least two hours.
- Optional reading and experiments are not counted as required time.
- The UI says that the displayed duration is an estimate, not a deadline.

## Workstream F: verify all references

### REF-01: Audit every source URL

Dependency: HC-02.

For every source:

1. Open the URL.
2. Confirm that it resolves.
3. Record the exact page title.
4. Locate the relevant heading.
5. Record a stable anchor when available.
6. Add a distinctive search phrase when no anchor exists.
7. Write a short course-owned summary of the relevant fact.
8. Map the source only to activities that use that fact.
9. Record version applicability.
10. Flag unstable, relocated, or unofficial sources.

Pay special attention to:

- broad TigerData documentation roots in core lessons
- the pg_roaringbitmap repository and PGXN roots in lesson 10
- duplicate Hypercore URLs in lesson 12
- mixed old and new TigerData documentation URL formats
- version-sensitive Toolkit and experimental APIs

## Separate project: query execution failures

### QUERY-00: Build a reproducible failure inventory

Do not mix this work into the pedagogy rewrite.

1. Start from a fresh seeded database.
2. Record PostgreSQL, TimescaleDB, Toolkit, and optional extension versions.
3. Run each Hardcore SQL block in curriculum order.
4. Record the lesson ID, activity ID, SQL, error, SQLSTATE, extension versions,
   and database prerequisites.
5. Classify each failure as:
   - SQL syntax error
   - unavailable extension or function
   - version incompatibility
   - incorrect schema assumption
   - missing setup
   - state mutation from an earlier activity
   - incorrect expected result
6. Fix failures in a separate change set.
7. Add execution regression tests after expected behavior is confirmed.

## Implementation order and dependencies

```text
HC-01 Activity schema
  -> HC-02 Reference schema
       -> HC-03 Content validation

HC-01 + HC-02
  -> UI-01 Guided activity rendering
       -> UI-02 Contextual highlighting
       -> UI-03 Hardcore tutor context
       -> UI-04 Browser tests

HC-01 + HC-02 + HC-03 + UI-01
  -> CUR-00 Lesson 00 pilot
       -> novice review and revision
            -> lessons 01-08
                 -> lessons 09-14
                      -> CUR-ANS answer consistency audit
                           -> TIME-01 measured duration update
                                -> REF-01 final source audit

Separate workstream:
QUERY-00 Query failure inventory and correction
```

Recommended curriculum migration batches:

1. Foundation: lesson 00.
2. Basic data model: lessons 01 and 02.
3. Lifecycle: lessons 03, 04, and 05.
4. Analysis and performance: lessons 06 and 07.
5. Integration: lesson 08.
6. Advanced storage: lessons 09 and 12.
7. Advanced time-series behavior: lessons 11 and 14.
8. Optional extensions and analytics: lessons 10 and 13.

Do not begin the next batch until the previous batch passes automated content
validation and novice review.

## Definition of done

The redesign is complete only when:

- Every required activity can be completed from information shown in the
  course.
- Every unfamiliar term is defined.
- Every instruction is an observable action.
- Important actions explain why they are needed.
- Every query has an expected output or invariant.
- Every exercise has progressive hints and a worked answer.
- Every writing or design exercise has a template and example.
- Every reference identifies an exact reading location or supplies a
  self-contained explanation.
- SQL highlights explain the current query rather than only generic grammar.
- Durations come from rewritten activities and novice walkthroughs.
- Required and optional work are clearly separated.
- Automated tests validate curriculum structure and browser rendering.
- A human reviewer verifies correctness and child-friendly clarity.
- Query execution failures remain tracked in their separate workstream.
