# claude-plugins

Redmern's plugins for [Claude Code](https://claude.com/claude-code), in one marketplace.

```
/plugin marketplace add Redmern/claude-plugins
/plugin install prompt-meter@redmern
/plugin install prompt-analyzer@redmern
```

| Plugin | What it does |
| --- | --- |
| [prompt-meter](https://github.com/Redmern/prompt-meter) | `/pm`: see how each prompt splits into tokens, how it moves the context window, and what every turn cost |
| [prompt-analyzer](https://github.com/Redmern/prompt-analyzer) | `/pa`: review a prompt before you send it: score, wording, missing context, skills to use, and an improved version |

Each plugin lives in its own repository; this one only lists them. Get new
versions with `/plugin marketplace update redmern`, then `/plugin update`.
