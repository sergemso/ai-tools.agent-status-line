// Injects a grouped panel into the Cursor usage dashboard.
// Runs on cursor.com, so fetch() reuses the signed-in session — no cookies
// are read or decrypted here.
(async () => {
  if (document.getElementById("conv-panel")) return;

  // content scripts are classic scripts, so pull the ESM helper in at runtime
  const { groupByConversation } = await import(
    chrome.runtime.getURL("group.js")
  );

  const PANEL_ID = "conv-panel";
  // Matches the dashboard endpoint cost-fetch.py uses.
  const ENDPOINT = "https://cursor.com/api/dashboard/get-filtered-usage-events";

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = [
    "position:fixed", "right:16px", "top:16px", "z-index:2147483647",
    "width:min(560px,46vw)", "max-height:80vh", "overflow:auto",
    "background:#1e1e1e", "color:#e6e6e6", "border:1px solid #3a3a3a",
    "border-radius:10px", "padding:12px",
    "font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
    "box-shadow:0 8px 32px rgba(0,0,0,.55)",
  ].join(";");

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;gap:8px;margin-bottom:10px";
  header.innerHTML =
    '<strong style="flex:1">By conversation</strong>' +
    '<select id="conv-hours" style="background:#2a2a2a;color:#e6e6e6;border:1px solid #444;border-radius:5px;padding:3px 5px">' +
    '<option value="6">6h</option>' +
    '<option value="24">24h</option>' +
    '<option value="72">3d</option>' +
    '<option value="168" selected>7d</option>' +
    "</select>" +
    '<button id="conv-refresh" style="background:#2a2a2a;color:#e6e6e6;border:1px solid #444;border-radius:5px;padding:3px 8px;cursor:pointer">Refresh</button>' +
    '<button id="conv-close" style="background:none;color:#888;border:0;cursor:pointer;font-size:15px">×</button>';

  const body = document.createElement("div");
  body.id = "conv-body";
  body.textContent = "Loading…";

  panel.append(header, body);
  document.body.appendChild(panel);

  const hoursEl = header.querySelector("#conv-hours");

  // Follow pages: page 1 caps at pageSize while still reporting a larger
  // total, so a single request silently truncates busy windows.
  async function fetchAll(start, end) {
    const events = [];
    let total = null;
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: start, endDate: end, page, pageSize: 1000 }),
      });
      if (res.status === 401 || res.status === 307) return { authError: true };
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const data = await res.json();
      if (total === null) total = data.totalUsageEventsCount;
      const batch = data.usageEventsDisplay || [];
      if (!batch.length) break;
      events.push(...batch);
      if (total !== null && events.length >= total) break;
      if (batch.length < 1000) break;
    }
    return { events };
  }

  async function load() {
    body.textContent = "Loading…";
    const hours = Number(hoursEl.value) || 168;
    const end = Date.now();
    const start = end - hours * 3600 * 1000;
    try {
      const { events, authError, error } = await fetchAll(start, end);
      if (authError) {
        body.textContent = "Not signed in to cursor.com — sign in and retry.";
        return;
      }
      if (error) {
        body.textContent = `Request failed: ${error}`;
        return;
      }
      render(groupByConversation(events));
    } catch (err) {
      body.textContent = "Fetch error: " + (err && err.message ? err.message : err);
    }
  }

  function render(groups) {
    body.textContent = "";
    if (!groups.length) {
      body.textContent = "No usage events in this window.";
      return;
    }
    const total = groups.reduce((s, g) => s + g.cents, 0);

    const summary = document.createElement("div");
    summary.style.cssText = "color:#9a9a9a;margin-bottom:8px";
    summary.textContent = `${groups.length} conversations · ${fmt(total)} total`;
    body.appendChild(summary);

    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse";
    table.innerHTML =
      "<thead><tr style='text-align:left;color:#8a8a8a'>" +
      "<th style='padding:3px 4px'>Conversation ID</th>" +
      "<th style='padding:3px 4px;text-align:right'>Cost</th>" +
      "<th style='padding:3px 4px;text-align:right'>Events</th>" +
      "<th style='padding:3px 4px'>Models</th>" +
      "</tr></thead>";

    const tbody = document.createElement("tbody");
    for (const g of groups) {
      const tr = document.createElement("tr");
      tr.style.cssText = "border-top:1px solid #2f2f2f;cursor:pointer";
      tr.title = "Click to copy ID";

      const idCell = document.createElement("td");
      idCell.style.cssText = "padding:4px;color:#7cc4ff";
      idCell.textContent = g.id;

      const costCell = document.createElement("td");
      costCell.style.cssText = "padding:4px;text-align:right;white-space:nowrap";
      costCell.textContent = fmt(g.cents);

      const evCell = document.createElement("td");
      evCell.style.cssText = "padding:4px;text-align:right;color:#9a9a9a";
      evCell.textContent = g.events;

      const modelCell = document.createElement("td");
      modelCell.style.cssText = "padding:4px;color:#9a9a9a";
      modelCell.textContent = g.models.join(", ");

      tr.append(idCell, costCell, evCell, modelCell);
      tr.addEventListener("click", () => {
        navigator.clipboard?.writeText(g.id);
        idCell.textContent = "copied";
        setTimeout(() => (idCell.textContent = g.id), 700);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    body.appendChild(table);
  }

  function fmt(cents) {
    const usd = cents / 100;
    if (usd >= 0.995) return `$${usd.toFixed(2)}`;
    return usd > 0 ? `$${usd.toFixed(4)}` : "$0";
  }

  header.querySelector("#conv-refresh").addEventListener("click", load);
  hoursEl.addEventListener("change", load);
  header.querySelector("#conv-close").addEventListener("click", () => panel.remove());

  load();
})();
