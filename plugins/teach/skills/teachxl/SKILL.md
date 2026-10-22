---
name: teachxl
description: Teach the user a new skill or concept with live, in-page chat. Extends the `teach` skill — lessons become interactive HTML where the user can click "Discuss" on any topic and go back-and-forth with you, grounded in the workspace.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

`teachxl` is the `teach` skill plus a **live chat layer**. Everything in
[`../teach/SKILL.md`](../teach/SKILL.md) still applies — the workspace layout,
the mission, lessons as self-contained HTML, reference docs, learning records,
the zone of proximal development. Read that skill first and follow it.

The one addition: **lessons become two-way**. Each lesson embeds discussable
topics. The user clicks "💬 Discuss" on a question or topic, a chat drawer opens
preloaded with that topic's context, and they have a real back-and-forth with
you — answers stream into the page, and durable insights get written back to
`./learning-records`.

## How the chat works

A browser can't call a CLI, so a small **local bridge** does three jobs:

1. Serves the teaching workspace over `http://localhost` (so lessons are
   same-origin and can `fetch`).
2. Exposes `POST /chat`, which proxies each question to you (Claude) via the
   Claude Agent SDK, running with the **workspace as cwd** — so you can read
   `MISSION.md`, the glossary, reference docs, other lessons, and learning
   records to ground every answer.
3. Streams your answer back to the page over SSE, and lets you append a
   learning record when the exchange teaches something durable.

```
browser (lesson) --fetch/SSE--> localhost bridge --Agent SDK query()--> you
                                      cwd = this teaching workspace
```

The bridge resumes a per-topic session, so each topic is a continuous thread.

## Setting up a workspace

The first time you use `teachxl` in a workspace (no `./bridge/` yet):

1. Copy the templates from this skill into the workspace:
   - `templates/bridge/` → `./bridge/`
   - `templates/assets/teach-chat.js` and `teach-chat.css` → `./assets/`
2. Install the bridge dependency: `cd bridge && npm install` (pulls
   `@anthropic-ai/claude-agent-sdk`).
3. Tell the user how to start it and that they should keep it running:
   - From the **workspace root**: `node bridge/server.mjs`
   - It prints a URL like `http://127.0.0.1:4317`. The user must open lessons
     through that URL, **not** `file://` — the chat only works same-origin.

Reuse is the default (per the `teach` Assets philosophy): `teach-chat.js/css`
are shared components every lesson links. Don't inline them per lesson.

## Authoring a lesson with chat

Author the lesson exactly as the `teach` skill describes, then make it
discussable:

- In `<head>`, link the shared component:
  ```html
  <link rel="stylesheet" href="/assets/teach-chat.css">
  <script src="/assets/teach-chat.js" defer></script>
  ```
- Wrap each question or topic you want discussable in a `data-teach-topic`
  element with an embedded grounding-context block. See
  [LESSON-CHAT-FORMAT.md](./LESSON-CHAT-FORMAT.md) for the exact markup.

Give every discussable topic a tight grounding context — the topic statement,
the canonical answer, and the primary source. That context is what you receive
alongside the user's question, so it keeps your answers anchored to the lesson
rather than drifting into parametric knowledge.

The skill's existing reminder — "ask your teacher follow-up questions" — is now
literal: the Discuss button is that teacher.

## Tests and the study overview

Lessons that test the user (quizzes) record results to the workspace, so after a
test you can build a **"what to study next"** overview from real performance
instead of a transient score. See [TEST-FORMAT.md](./TEST-FORMAT.md) for the
quiz/test markup.

- Each quiz answer is appended to `./study-log.jsonl` via the bridge — durable,
  and readable by you next session.
- A "Finish test" button computes a local score and asks the bridge to run you
  over the log: you rank the weak topics, save `./reference/study-overview.html`
  (printable, in the reference style), append a learning record, and stream the
  prioritized plan into the page.

`study-log.jsonl` is part of the workspace's learning state. When picking the
next lesson or computing the zone of proximal development, read it alongside the
learning records — it is the ground-truth signal of what hasn't stuck.

## Write-back to learning records

The bridge runs you with file tools, but constrained: you may only write under
`./learning-records/` (using the existing numbering and
[LEARNING-RECORD-FORMAT](../teach/LEARNING-RECORD-FORMAT.md)) and `NOTES.md`.
Never modify lessons, reference docs, or anything else from a chat turn.

When a discussion reveals a non-obvious insight the user has now grasped, or
corrects a misconception, append a learning record — exactly as you would after
an in-terminal lesson. This is what keeps the zone-of-proximal-development
calculation accurate across sessions.

## When to use teachxl vs teach

Use `teachxl` when the user wants lessons they can interrogate in the browser.
Use plain `teach` for lessons meant only to be read/printed, or when running a
local bridge isn't wanted. The workspaces are compatible — a `teach` workspace
can be upgraded by installing the bridge and re-authoring lessons with
discussable topics.
