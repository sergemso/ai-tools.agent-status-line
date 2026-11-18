# Cursor usage by conversation

A minimal Chrome extension that adds a floating panel to
https://cursor.com/dashboard/usage showing usage **grouped by conversation ID**,
with cost, event count and models per conversation.

Cursor's payload carries no session cost, so as `docs/cursor.md` notes the
status line shows no cost for Cursor. Verifying a Cursor session's cost means
checking Cursor's own usage dashboard, which lists events individually. This
tool groups them so a per-session total is readable.

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and choose this folder
4. Open https://cursor.com/dashboard/usage while signed in — a panel appears
   top-right

Pick a window (6h / 24h / 7d) and hit **Refresh**. Click any conversation ID to
copy it.

## How it works

It runs on `cursor.com`, so `fetch(..., { credentials: "include" })` reuses the
session you are already signed into. It does **not** read, copy or decrypt any
cookie.

It calls the same endpoint the dashboard itself uses:

```
POST https://cursor.com/api/dashboard/get-filtered-usage-events
```

and sums `chargedCents` per `conversationId`.

## Checking the math

```bash
node check.js                    # synthetic assertions only
node check.js events.json        # also run against a real captured response
```

`check.js` covers: summing multiple events per conversation, the
`tokenUsage.totalCents` fallback, the dashboard's `"-"` chargedCents quirk,
events with no `conversationId` (bucketed, not dropped), newest-first ordering,
and that grouping conserves total cost.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest, scoped to the usage page |
| `group.js` | the grouping logic (ESM; shared with `check.js`) |
| `content.js` | the injected panel and fetch |
| `check.js` | runnable assertions |

`content.js` loads `group.js` at runtime via `chrome.runtime.getURL`, because
MV3 content scripts are classic scripts and cannot use static `import`.
