# Test format & study tracking

`teachxl` records test results to the workspace so that, after a test, you can
synthesize a **"what to study next"** overview from real performance — not just
a score. Results are durable (they survive the browser) and visible to you on
the next session, feeding the zone-of-proximal-development calculation.

## How it flows

```
quiz answer  --POST /record-->  bridge  -->  ./study-log.jsonl   (one JSON line per event)
Finish test  --POST /overview-> bridge  -->  you (Claude) read the log, analyze,
                                             write ./reference/study-overview.html
                                             + a learning record, stream the plan back
```

## Built-in quiz convention (no JS to write)

Wrap each question in `data-teach-quiz`; mark the right answer button with
`data-correct`. Group questions in a `data-teach-test` with a finish trigger:

```html
<div data-teach-test="chapter-1-test">

  <div data-teach-quiz="tail-recursion" data-question="What makes a call tail-recursive?">
    <p>What makes a call tail-recursive?</p>
    <button data-correct>It is the last action in the function.</button>
    <button>It calls itself more than once.</button>
    <button>It has no base case.</button>
  </div>

  <div data-teach-quiz="stack-frames" data-question="What does a stack frame hold?">
    <p>What does a stack frame hold?</p>
    <button>Only the return address.</button>
    <button data-correct>Locals, args, and the return address.</button>
    <button>The entire heap.</button>
  </div>

  <button data-teach-finish>Finish test → what to study next</button>
</div>
```

The widget marks correct/incorrect on click, records each answer, and — on
finish — computes a local score and asks the bridge to build the overview.

- Keep answer options equal length (per the teach skill quiz rule) so formatting
  gives nothing away.
- `data-teach-quiz` ids should map to topic/glossary terms — they become the
  keys you analyze weakness by.
- If `data-question` is omitted, the first heading/paragraph text is used.
- If you omit `data-teach-finish`, the widget appends a default finish button.

## Custom quizzes

Already have your own quiz/simulator JS? Skip the convention and call the API:

```js
window.teachxl.record({
  kind: 'quiz', testId: 'chapter-1-test', topicId: 'tail-recursion',
  question: 'What makes a call tail-recursive?',
  chosen: 'It calls itself more than once.', correct: false,
});
// …after the last question…
window.teachxl.finishTest('chapter-1-test', { total: 8, correct: 5 });
```

You can also record non-quiz signals (e.g. `{ kind: 'flagged', topicId, note }`)
when the learner marks something unclear.

## study-log.jsonl

One JSON object per line, appended by the bridge. Fields are whatever the page
sends, plus a server `ts`. Typical quiz event:

```json
{"ts":"2026-06-20T10:14:02.511Z","lesson":"/lessons/0001-recursion.html","kind":"quiz","testId":"chapter-1-test","topicId":"tail-recursion","question":"What makes a call tail-recursive?","chosen":"It calls itself more than once.","correct":false}
```

When asked to teach a future lesson, read `study-log.jsonl` alongside the
learning records to judge what the user has and hasn't retained.

## The overview

On finish, the bridge runs you (Claude) with the overview instructions: read the
latest attempt in `study-log.jsonl`, rank weak topics by priority against the
mission, point each to the relevant lesson/reference and a primary source, save
`./reference/study-overview.html` (printable, in the teach reference style), and
append a learning record capturing the gaps. The prioritized plan streams into
the overview panel in the page.
