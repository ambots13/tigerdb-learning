# Plan: Make Hardcore non-SQL activities answerable and self-checking

## Purpose

Repair the Hardcore activities that ask learners to write, draw, prove, explain, or
design something without providing a place to answer or a meaningful way to check
their work.

This is an implementation plan only. It does not contain the rewritten lesson
answers.

## Why `Prove half-open boundaries` currently fails

The concept is worth teaching. Chunk boundaries determine which chunk owns a row,
prevent adjacent chunks from overlapping, and affect how learners reason about
time filters. The current activity does not teach or assess that concept well.

The rendered activity has five concrete problems:

1. **Undefined language:** “membership inequalities” and `[start,end)` are used
   before the activity explains them in beginner language.
2. **No answer location:** “Write” sounds like a task, but the browser provides no
   input. It does not say whether to use paper, a text editor, SQL, or the course UI.
3. **Generic expected result:** both steps say only, “You have a concrete note,
   table, or answer for this step.”
4. **Circular checking:** the quick check asks learners to identify the kind of
   evidence requested, not to solve the boundary question.
5. **No usable answer key:** the worked answer repeats “show a boundary proof”
   instead of demonstrating one, so a beginner cannot tell whether their reasoning
   is correct.

The result is an activity that appears rigorous but cannot be completed or
verified inside the product.

## Audit findings

The audit loaded the normalized curriculum through `getHardcoreLesson`, rather
than judging only the compact source definitions.

- Total non-SQL Hardcore activities: **83**
- Activities with authored, concept-specific interactions: **6**
- Activities receiving the generic multiple-choice, expected-result, and worked-
  answer fallbacks: **77**
- All **4** non-SQL activities in Lesson 01 are affected.
- The six authored Lesson 10 activities are the current positive reference.

### Affected count by lesson

| Lesson | Affected non-SQL activities |
| --- | ---: |
| 00 | 5 |
| 01 | 4 |
| 02 | 4 |
| 03 | 6 |
| 04 | 5 |
| 05 | 6 |
| 06 | 5 |
| 07 | 5 |
| 08 | 6 |
| 09 | 6 |
| 10 | 0 |
| 11 | 6 |
| 12 | 6 |
| 13 | 6 |
| 14 | 7 |
| **Total** | **77** |

A rough format classification found 32 visual/table/diagram tasks, 24 design or
decision tasks, 15 explanation tasks, 2 calculation tasks, and 4 other tasks.
Treat these counts as triage guidance, not as a replacement for reviewing each
activity.

### Systemic causes

- `normalizeActivity` generates a generic evidence-recognition question for any
  non-SQL activity without authored multiple-choice data.
- `normalizeStep` gives every non-SQL step the same expected result and recovery
  advice.
- The fallback hints and worked answer restate the evidence requirement instead of
  teaching or checking the concept.
- The browser offers one quick-check selection and a self-reported mastery
  checkbox, but no response surface for the written artifacts requested by the
  instructions.
- Validation checks that fields exist, but not that questions assess the activity,
  distractors are plausible, terminology is introduced, or worked answers are
  usable.

## Product decision to preserve

The course already established this rule:

> If an activity has no SQL to load, the learner answers it with multiple choice.

Do not add a required paper exercise or an ungraded free-text box as the main fix.
Rewrite required non-SQL work into one or more concept-specific multiple-choice
checks that can be completed and verified in the browser.

If an author still wants a drawing, design note, or verbal explanation for deeper
practice, label it **Optional reflection**, state where the learner may record it,
and exclude it from required progress.

## Target learning contract

Every required non-SQL activity must provide:

1. A plain-language goal that says what the learner will decide.
2. Definitions for every technical term needed to answer.
3. One to three small multiple-choice checks, each testing a real concept rather
   than asking which evidence sounds appropriate.
4. Plausible distractors derived from common misconceptions.
5. Immediate feedback that explains why the selected answer is right or wrong.
6. A concise worked explanation revealed only after an attempt.
7. A deterministic completion rule: required checks must be correct before the
   activity counts toward mastery.
8. No instruction to write, sketch, draw, or prove a required artifact unless the
   UI actually collects and checks that artifact.

## Phase 1: Strengthen the activity schema

### Files

- `src/hardcore-schema.mjs`
- `src/hardcore-validation.mjs`
- `test/hardcore.test.mjs`

### Work

1. Replace the single `multipleChoice` fallback with an authored `checks` array for
   non-SQL activities.
2. Give each check a stable ID, prompt, three or four options, answer index, correct
   explanation, and targeted retry explanation.
3. Allow one check for a simple distinction and two or three checks for a sequence,
   scenario, calculation, or diagram interpretation.
4. Remove the generic question beginning with “Which evidence would best show…”.
   Missing authored checks must become a validation failure, not a silent fallback.
5. Remove generic non-SQL step output such as “You have a concrete note, table, or
   answer.” An activity must instead author a specific observable result or omit
   the step in favor of its checks.
6. Require concept-specific vocabulary when a prompt uses notation or specialized
   terms. The default definitions of only `evidence` and `invariant` are not enough.
7. Reject circular worked answers that merely repeat an evidence item or begin
   with “Complete the requested work and show”.
8. Keep SQL activities on their existing SQL/starter-SQL path.

### Compatibility

Normalize the six existing Lesson 10 authored questions into the new `checks`
shape without changing their wording or behavior. If saved progress uses one value
per activity, migrate it to values keyed by activity ID and check ID.

## Phase 2: Update the browser interaction

### Files

- `src/web/public/app.js`
- `src/web/public/style.css`
- `test/hardcore-browser-contract.test.mjs`

### Work

1. Render all checks for a non-SQL activity in their authored order.
2. Show progress such as “Check 1 of 2” without hiding later context.
3. Keep an incorrect response retryable.
4. Use targeted incorrect feedback; do not reuse “re-read the goal and evidence”
   for every mistake.
5. Show the correct explanation after a correct response.
6. Persist each check independently.
7. Disable or replace the self-reported mastery checkbox for required non-SQL
   activities. Mark mastery automatically only when all required checks are
   correct.
8. Clearly label any non-required writing or drawing prompt as “Optional
   reflection” and state that it is not automatically checked.
9. Preserve keyboard operation, focus visibility, button semantics, and live
   feedback announcements.

## Phase 3: Rewrite Lesson 01 first

### Primary activity: `01-activity-03`

Replace “Prove half-open boundaries” with a beginner sequence that:

1. Introduces the notation in ordinary words before using its technical name.
2. Uses a small adjacent-chunk diagram or timeline with concrete timestamps.
3. Asks a first multiple-choice question about which boundaries a single range
   includes.
4. Asks a second question that places a row occurring exactly at the shared
   boundary.
5. Explains how the two decisions prevent overlap.
6. Provides misconception-specific feedback for including both ends, excluding
   both ends, or assigning the boundary row twice.
7. Uses a title based on the learner action, such as locating a boundary row,
   rather than the intimidating verb “prove”.

Do not require the learner to write mathematical notation. The worked explanation
may introduce the formal notation after the plain-language model is understood.

### Other Lesson 01 activities

Rewrite these in the same pass:

- `01-activity-09` — turn the sizing scenario into staged choices that require
  selecting assumptions, a starting recommendation, and evidence that would
  justify revising it.
- `01-activity-10` — ask directly about existing versus future chunks, with
  distractors based on the rewrite misconception.
- `01-activity-11` — replace the uncheckable sketch and rubric request with a short
  cumulative scenario using concrete ranges and workload facts.

### Lesson 01 acceptance check

A person unfamiliar with interval notation must be able to complete all four
non-SQL activities using only the browser, receive specific feedback, and know why
the accepted choice is correct.

## Phase 4: Rewrite the remaining 73 affected activities

Work lesson by lesson. Do not generate distractors by template.

### Priority order

1. **Lessons 00–02:** prerequisite concepts and first exposure to Hardcore Mode.
2. **Lessons 03–08:** lifecycle, policy, and analytical-state reasoning.
3. **Lesson 09:** index decisions; use Lesson 10 as the authored interaction
   reference where useful.
4. **Lessons 11–14:** production boundaries, schema choices, hyperfunction
   semantics, and query-plan interpretation.

### Conversion patterns

| Existing request | Required conversion |
| --- | --- |
| Draw/sketch/map a diagram | Show a small authored diagram and ask the learner to identify, order, or correct its parts. |
| Write an explanation | Ask which explanation is accurate, then explain why each misconception fails. |
| Design/recommend/choose | Split the scenario into constraints, decision, and verification checks. |
| Calculate/estimate | Provide concrete inputs, answer ranges where appropriate, and show the calculation after the attempt. |
| Closed-book defense | Use a short cumulative scenario with two or three checks; do not ask for an invisible essay. |
| Review/correct a claim | Present the claim and ask which correction is defensible, with evidence-specific feedback. |

### Authoring rules

- One check should test one decision.
- Prompts must contain all facts needed to answer or link directly to the displayed
  result/diagram.
- Avoid “best” unless the scenario defines the criterion.
- Avoid trick questions and obviously absurd distractors.
- Keep options parallel in grammar and scope.
- Do not use the correct option as a verbatim copy of the evidence text.
- Explain the misconception behind each distractor.
- Keep beginner wording first; introduce the database term second.
- Use diagrams only when spatial or sequential relationships matter.

## Phase 5: Add quality gates

### Automated tests

Add data-driven tests that fail when:

- a non-SQL activity has no authored checks;
- any check has fewer than three distinct options;
- a check lacks targeted retry feedback;
- an answer index is invalid;
- a worked answer equals or merely wraps an evidence item;
- generic phrases such as “Which evidence would best show”, “You have a concrete
  note”, or “Complete the requested work and show” return;
- a required instruction begins with write/draw/sketch/prove but the activity has
  no supported response mechanism;
- progress can be marked complete before all required checks are correct;
- IDs are duplicated across checks.

Keep the existing curriculum completeness and SQL inventory tests.

### Browser verification

Test at least:

1. Lesson 01 boundary activity: wrong boundary choice, targeted feedback, retry,
   correct choice, second check, automatic mastery, reload persistence.
2. One diagram interpretation activity.
3. One design/recommendation scenario.
4. One calculation activity.
5. One Lesson 10 activity to catch compatibility regressions.
6. Keyboard-only navigation and visible focus.
7. Standard Mode and SQL activities remain unchanged.

## Completion criteria

The remediation is complete only when:

- all 83 non-SQL activities have authored concept checks;
- none uses the three generic fallback phrases;
- no required task implies paper or an unavailable text-entry surface;
- every technical term needed for a check is defined before the check;
- incorrect options produce useful, misconception-specific feedback;
- worked explanations let a beginner verify the reasoning;
- completion is earned from correct checks rather than self-reporting;
- progress survives reload;
- all automated tests pass;
- browser testing covers each interaction pattern with zero console or rendering
  errors.

## Useful audit command

After implementation, load every normalized lesson and inspect non-SQL activities,
not only the compact curriculum source. The audit should report zero generic
questions, zero generic expected results, and zero circular worked answers.

The relevant normalized access path is:

```js
getHardcoreLesson(id).deepDive.phases.flatMap((phase) => phase.activities)
```

## Expected implementation surfaces

- `src/hardcore-curriculum-core.mjs`
- `src/hardcore-curriculum-advanced.mjs`
- `src/hardcore-schema.mjs`
- `src/hardcore-validation.mjs`
- `src/web/public/app.js`
- `src/web/public/style.css`
- `test/hardcore.test.mjs`
- `test/hardcore-browser-contract.test.mjs`

Do not edit generated lesson READMEs unless a documentation generator is extended
to emit Hardcore activities. Regenerate documentation only when its source or
generator changes.
