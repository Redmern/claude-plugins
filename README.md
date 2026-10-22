# claude-plugins

Redmern's plugins for [Claude Code](https://claude.com/claude-code), in one marketplace.

```
/plugin marketplace add Redmern/claude-plugins
/plugin install prompt-meter@redmern
/plugin install prompt-analyzer@redmern
/plugin install teach@redmern
```

| Plugin | What it does |
| --- | --- |
| [prompt-meter](https://github.com/Redmern/prompt-meter) | `/pm`: see how each prompt splits into tokens, how it moves the context window, and what every turn cost |
| [prompt-analyzer](https://github.com/Redmern/prompt-analyzer) | `/pa`: review a prompt before you send it: score, wording, missing context, skills to use, and an improved version |
| [teach](plugins/teach) | `/teach:teach`: learn a topic over several sessions, with a mission, lessons, a glossary and a learning record in your workspace. `/teach:teachxl`: the same, with interactive HTML lessons and live in-page chat |

prompt-meter and prompt-analyzer live in their own repositories; teach lives
in this one, under `plugins/teach`. Get new versions with
`/plugin marketplace update redmern`, then `/plugin update`.
