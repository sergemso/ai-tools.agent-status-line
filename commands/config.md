---
description: Change status line settings — text style, separator, sections, reset windows, base model, color breakpoints (no args = guided)
disable-model-invocation: true
allowed-tools: Bash, AskUserQuestion
---

Settings tool: `"${CLAUDE_PLUGIN_ROOT}/bin/statusline" config`. Run it with Bash, quoting each argument. Report its output tersely.

**If `$ARGUMENTS` is not empty:** run `config $ARGUMENTS`. On an error, show it and stop.

**If `$ARGUMENTS` is empty:** make exactly ONE AskUserQuestion call with these four questions (the first option of each is "Keep current", which changes nothing):

1. Text style (header "Style"): Keep current, `glyph` ("⚡ 3.6¢"), `short` ("next 3.6¢"), `words` ("next call 3.6¢"). `auto` (default: most readable that fits the width) and `ascii` ("nx 3.6c") via Other. Apply: `config format STYLE`.
2. Separator between groups (header "Separator"): Keep current, `·`, `•`, `|`. Anything else (1-3 visible characters, or `space`) or `default` via Other. Apply: `config separator X`.
3. Reset windows (header "Resets"): Keep current, `5h,7d,spend`, `5h,7d`, `none`. Custom list or `all` via Other. Apply: `config resets LIST`.
4. Sections to hide (header "Hide", multi-select, none selected = keep): `cost`, `overhead`, `cache`, `context`. Others (`model tokens stats resets`; stats = always show the cache hit rate) or "show all" via Other. Apply: `config sections hide NAME...` (`config sections all` for show all).

Then apply every changed answer in ONE Bash call (chain the `config` commands with `;`), ending with `config show; config format`. Report the changes in one line. Do not ask follow-up questions.

Settings apply on the next status line refresh. Base model and color breakpoints are not in the guided flow: tell the user to ask for them directly (`/statusline:config model NAME`, `/statusline:config thresholds context 60 85`). Scripting any setting costs no tokens: `"${CLAUDE_PLUGIN_ROOT}/bin/statusline" config <command>` (`config help` lists them).
