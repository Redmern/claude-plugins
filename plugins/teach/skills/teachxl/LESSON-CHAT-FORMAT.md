# Lesson chat format

How to make a topic in a lesson discussable. The shared widget
(`/assets/teach-chat.js`) scans for these on load.

## Mark a discussable topic

Wrap the question/topic in an element with `data-teach-topic="<stable-id>"` and
embed a grounding-context block as a non-rendered script tag:

```html
<div class="topic" data-teach-topic="why-tail-recursion">
  <h3>Why does tail recursion avoid stack growth?</h3>
  <p>… your lesson prose explaining it …</p>

  <script type="application/teach-context">
  {
    "title": "Why tail recursion avoids stack growth",
    "statement": "A call in tail position can reuse the current frame instead of pushing a new one.",
    "answer": "When the recursive call is the last action, no state needs to survive it, so the compiler/runtime can replace the current frame rather than stack another — turning recursion into iteration.",
    "source": "https://example.org/tail-calls"
  }
  </script>
</div>
```

The widget injects a "💬 Discuss" button into the topic element. Clicking it:

- opens the chat drawer,
- shows the topic title,
- sends the embedded context to the bridge with the user's first message,
- keeps a continuous thread for that `data-teach-topic` id (resumed via the
  bridge session, persisted in `localStorage`).

## Context fields

All optional except you should give at least `title` + `answer`. The whole
object is handed to you (Claude) verbatim with each question.

| field       | purpose                                                        |
|-------------|----------------------------------------------------------------|
| `title`     | shown as the drawer header; short label for the topic          |
| `statement` | the one-line claim/question being discussed                    |
| `answer`    | the canonical answer from the lesson — your anchor             |
| `source`    | primary high-trust source URL for this topic                   |

Add any extra fields you find useful (e.g. `glossary`, `prerequisite`) — they
pass through unchanged.

## Rules

- `data-teach-topic` ids must be **stable** across edits of a lesson — they key
  the saved thread. Renaming an id starts a fresh thread.
- One context block per topic element. If absent, the widget still adds a button
  but sends only the question text.
- Keep contexts tight. They are grounding, not the whole lesson — the bridge can
  read the full lesson file if you need more.
