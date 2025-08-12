/* =========================================================
   Market Prices – EverythingPallets (refined JS)
   - Clean chart lifecycle + fixed mobile height
   - Robust number parsing & trend normalization
   - Stable sparkline heights
   - Location → materials sync, specs + timestamps
   ========================================================= */

(() => {
  // ---------- Config ----------
  const SHEET_URL = "https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf";
  const WHATSAPP_NUMBER = "919999999999"; // placeholder

  // ---------- State ----------
  let rawRows = [];
  let dataset = {}; // { [loc]: { materials: { pellets:{}, briquettes:{} } } }
  let locations = [];

  let pelletChart = null;
  let briquetteChart = null;

  // ---------- Utils ----------
  const ce = (t) => document.createElement(t);
  const fmtINR = (n) => (Number.isFinite(n) ? n.toLocaleString("en-IN") : "--");
  const toInt = (v) => {
    if (v === null || v === undefined) return 0;
    const n = parseInt(String(v).replace(/,/g, "").trim(), 10);
    return Number.isNaN(n) ? 0 : n;
  };

  // ---------- Data Load ----------
  async function loadData() {
    const res = await fetch(SHEET_URL);
    rawRows = await res.json();

    const map = {};
    for (const row of rawRows) {
      const state = row.State?.trim();
      const mat = row.Material?.trim();
      const type = row.Type?.trim()?.toLowerCase();
      if (!state || !mat || !type) continue;
      if (!map[state]) map[state] = { materials: { pellets: {}, briquettes: {} } };

      const packet = {
        price: toInt(row.Week),
        trend: [toInt(row.Year), toInt(row["6 Month"]), toInt(row.Month), toInt(row.Week)],
        kcal: toInt(row.Kcal) || undefined,
        ash: row.Ash?.toString()?.trim() || undefined,
        moisture: row.Moisture?.toString()?.trim() || undefined
      };

      if (type.includes("pellet")) map[state].materials.pellets[mat] = packet;
      else map[state].materials.briquettes[mat] = packet;
    }

    // Locations (excluding GLOBAL)
    locations = Object.keys(map).filter((l) => l.toUpperCase() !== "GLOBAL").sort();
    dataset = map;

    const last = rawRows.find((r) => r["Last Updated"]);
    if (last) {
      const el = document.getElementById("marketLastUpdated");
      if (el) el.textContent = `Last updated: ${last["Last Updated"]}`;
    }
  }

  // ---------- Dropdowns ----------
  function populateDropdowns() {
    const locSel = document.getElementById("locationSelect");
    if (!locSel) return;
    locSel.innerHTML = "";
    locations.forEach((loc) => {
      const opt = ce("option");
      opt.value = opt.textContent = loc;
      locSel.appendChild(opt);
    });
    if (locations.length) locSel.value = locations[0];
    refreshMaterialDropdowns(locSel.value);
  }

  function refreshMaterialDropdowns(loc) {
    const pelletSel = document.getElementById("materialSelect");
    const briqSel = document.getElementById("briquetteSelect");
    if (!pelletSel || !briqSel) return;

    pelletSel.innerHTML = "";
    briqSel.innerHTML = "";

    const pellets = Object.keys(dataset[loc]?.materials?.pellets || {});
    const briqs = Object.keys(dataset[loc]?.materials?.briquettes || {});
    pellets.forEach((m) => pelletSel.appendChild(new Option(m, m)));
    briqs.forEach((m) => briqSel.appendChild(new Option(m, m)));

    if (pellets.length) pelletSel.value = pellets[0];
    if (briqs.length) briqSel.value = briqs[0];
  }

  // ---------- Tables ----------
  function sparkHeights(trend) {
    const vals = (trend || []).filter((v) => Number.isFinite(v) && v > 0);
    if (!vals.length) return [12, 12, 12, 12];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const scale = (v) => {
      if (!Number.isFinite(v) || v <= 0) return 10;
      if (max === min) return 22; // flat trend
      const t = (v - min) / (max - min);
      return 10 + Math.round(t * 22); // 10–32px
    };
    return (trend || [0, 0, 0, 0]).map(scale);
  }

  function renderTables(loc) {
    const pTable = document.getElementById("materialTable");
    const bTable = document.getElementById("briquetteTable");

    const pellets = dataset[loc]?.materials?.pellets || {};
    const briqs = dataset[loc]?.materials?.briquettes || {};

    if (pTable) {
      const rows = Object.entries(pellets).map(([name, { price, trend }]) => {
        const hs = sparkHeights(trend);
        const spark = hs.map((h) => `<span class="spark" style="height:${h}px"></span>`).join("");
        return `<tr><td>${name}</td><td><strong>₹${fmtINR(price)}</strong></td><td class="sparkline">${spark}</td></tr>`;
      }).join("");
      pTable.innerHTML =
        `<thead><tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr></thead>
         <tbody>${rows || `<tr><td colspan="3">No data</td></tr>`}</tbody>`;
    }

    if (bTable) {
      const rows = Object.entries(briqs).map(([name, { price, trend }]) => {
        const hs = sparkHeights(trend);
        const spark = hs.map((h) => `<span class="spark briq" style="height:${h}px"></span>`).join("");
        return `<tr><td>${name}</td><td><strong>₹${fmtINR(price)}</strong></td><td class="sparkline">${spark}</td></tr>`;
      }).join("");
      bTable.innerHTML =
        `<thead><tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr></thead>
         <tbody>${rows || `<tr><td colspan="3">No data</td></tr>`}</tbody>`;
    }
  }

  // ---------- Charts ----------
  function makeChartConfig(label, data, colorLine, colorFill) {
    return {
      type: "line",
      data: {
        labels: ["Year", "6 Months", "Month", "Week"],
        datasets: [{
          label,
          data,
          borderColor: colorLine,
          backgroundColor: colorFill,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `₹${ctx.parsed.y.toLocaleString("en-IN")}/ton`
            }
          }
        },
        scales: {
          y: {
            ticks: { callback: (v) => `₹${v.toLocaleString("en-IN")}` }
          }
        }
      }
    };
  }

  function updateSpecsFrom(matPacket, specIds) {
    if (!matPacket) {
      ["Ash", "Moisture", "Kcal"].forEach((k) => {
        const el = document.getElementById(specIds[k]);
        if (el) el.textContent = "--";
      });
      return;
    }
    const { ash, moisture, kcal } = matPacket;
    if (document.getElementById(specIds.Ash)) document.getElementById(specIds.Ash).textContent = ash ?? "--";
    if (document.getElementById(specIds.Moisture)) document.getElementById(specIds.Moisture).textContent = moisture ?? "--";
    if (document.getElementById(specIds.Kcal)) document.getElementById(specIds.Kcal).textContent = kcal ? fmtINR(kcal) : "--";
  }

  function forceCanvasHeight(id, px = 240) {
    const c = document.getElementById(id);
    if (!c) return;
    c.style.height = px + "px";     // fixes huge canvases on some mobiles
    c.height = px;                  // enforce internal resolution
    if (c.parentElement) {
      c.parentElement.style.minHeight = px + "px";
    }
  }

  function drawCharts(loc) {
    const pelletSel = document.getElementById("materialSelect");
    const briqSel = document.getElementById("briquetteSelect");

    const pMat = pelletSel?.value;
    const bMat = briqSel?.value;

    const pPacket = dataset[loc]?.materials?.pellets?.[pMat];
    const bPacket = dataset[loc]?.materials?.briquettes?.[bMat];

    // enforce reasonable height via JS
    forceCanvasHeight("priceChart", 240);
    forceCanvasHeight("briquetteChart", 240);

    // Destroy & recreate to avoid zombie sizing issues
    if (pelletChart) { pelletChart.destroy(); pelletChart = null; }
    if (briquetteChart) { briquetteChart.destroy(); briquetteChart = null; }

    const pCfg = makeChartConfig(pMat || "Pellet", (pPacket?.trend || []).map(toInt), "#1C3D5A", "#DDEAF4");
    const bCfg = makeChartConfig(bMat || "Briquette", (bPacket?.trend || []).map(toInt), "#FFA500", "#FFEFD5");

    const pCtx = document.getElementById("priceChart")?.getContext("2d");
    const bCtx = document.getElementById("briquetteChart")?.getContext("2d");
    if (pCtx) pelletChart = new Chart(pCtx, pCfg);
    if (bCtx) briquetteChart = new Chart(bCtx, bCfg);

    // specs + timestamps
    updateSpecsFrom(pPacket, { Ash: "pelletAsh", Moisture: "pelletMoisture", Kcal: "pelletKcal" });
    updateSpecsFrom(bPacket, { Ash: "briquetteAsh", Moisture: "briquetteMoisture", Kcal: "briquetteKcal" });

    const last = rawRows.find((r) => r["Last Updated"]);
    if (last) {
      const t1 = document.getElementById("pelletTimestamp");
      const t2 = document.getElementById("briquetteTimestamp");
      if (t1) t1.textContent = last["Last Updated"];
      if (t2) t2.textContent = last["Last Updated"];
    }
  }

  // ---------- Page Orchestration ----------
  function refreshAll() {
    const locSel = document.getElementById("locationSelect");
    if (!locSel || !locSel.value) return;
    const loc = locSel.value;

    refreshMaterialDropdowns(loc);
    renderTables(loc);
    drawCharts(loc);
  }

  function bindCoreHandlers() {
    const locSel = document.getElementById("locationSelect");
    const pelletSel = document.getElementById("materialSelect");
    const briqSel = document.getElementById("briquetteSelect");

    locSel?.addEventListener("change", refreshAll);
    pelletSel?.addEventListener("change", () => {
      const loc = locSel.value;
      drawCharts(loc);
    });
    briqSel?.addEventListener("change", () => {
      const loc = locSel.value;
      drawCharts(loc);
    });

    // Redraw on rotate/resize to keep height sane
    window.addEventListener("resize", () => {
      const loc = locSel?.value;
      if (loc) drawCharts(loc);
    });
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await loadData();
      populateDropdowns();
      bindCoreHandlers();
      refreshAll();
    } catch (e) {
      console.error("Market page init failed:", e);
    }
  });
})();