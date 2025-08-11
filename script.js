/* ==========================================================
   Market (ONE FILE): Sheet.best data + tables + charts + tools
   ========================================================== */

const API_URL = "https://api.sheetbest.com/sheets/5ac0ae3c-c8d3-4f90-a9af-18198287e688";

let rawData = [];
let chartPellet = null;
let chartBriq = null;

// ---- small helpers
const $  = (id) => document.getElementById(id);
const fmtINR = (n) => Number(n || 0).toLocaleString("en-IN");
const UC = (s) => (s || "").toString().trim().toUpperCase();
const parseNum = (v) => {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const niceDate = (d = new Date()) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/* ===========================
   INIT
   =========================== */
document.addEventListener("DOMContentLoaded", initMarket);

async function initMarket() {
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    rawData = await res.json();

    // normalize keys defensively
    rawData = rawData.map((r) => ({
      State: (r.State ?? r.state ?? r.STATE ?? "").toString().trim(),
      Material: (r.Material ?? r.material ?? r.MATERIAL ?? "").toString().trim(),
      Type: (r.Type ?? r.type ?? r.TYPE ?? "").toString().trim(),
      Price: parseNum(r.Price ?? r.price ?? r.PRICE),
      Year: parseNum(r.Year ?? r.year ?? r.YEAR),
      SixMonth: parseNum(r["6 Month"] ?? r["6Month"] ?? r["6mo"] ?? r.sixMonth ?? r.SixMonth),
      Month: parseNum(r.Month ?? r.month ?? r.MONTH),
      Week: parseNum(r.Week ?? r.week ?? r.WEEK),
      UpdatedAt: r.UpdatedAt ?? r.updatedAt ?? r.updated ?? null,
    }));

    // Controls
    populateLocations();
    const defaultState =
      rawData.find((x) => UC(x.State) === "AVERAGE")?.State ||
      [...new Set(rawData.map((r) => r.State))][0];

    if ($("locationSelect")) $("locationSelect").value = defaultState;
    refreshForState(defaultState);

    // listeners for core controls
    $("locationSelect")?.addEventListener("change", (e) => refreshForState(e.target.value));
    $("materialSelect")?.addEventListener("change", () => drawPelletChart());
    $("briquetteSelect")?.addEventListener("change", () => drawBriqChart());

    // expose minimal helpers for tools
    window.MP = {
      getCurrentPelletPrice: () => getFirstPriceFor("PELLET"),
      getCurrentBriqPrice: () => getFirstPriceFor("BRIQUETTE"),
    };

    // init Tools section listeners
    initFreightTool();
    initFuelComparison();
    initSubmitAndCall();
  } catch (err) {
    console.error("Market init failed:", err);
    if ($("materialTable"))
      $("materialTable").innerHTML = "<tbody><tr><td>Failed to load market data.</td></tr></tbody>";
  }
}

/* ===========================
   CONTROLS
   =========================== */
function populateLocations() {
  const sel = $("locationSelect");
  if (!sel) return;
  const states = [...new Set(rawData.map((r) => r.State).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
  sel.innerHTML = states.map((s) => `<option value="${s}">${s}</option>`).join("");
}

function populateMaterials(state) {
  const rows = rawData.filter((r) => r.State === state);

  const pelletMats = [
    ...new Set(rows.filter((r) => UC(r.Type) === "PELLET").map((r) => r.Material).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const briqMats = [
    ...new Set(rows.filter((r) => UC(r.Type) === "BRIQUETTE").map((r) => r.Material).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  if ($("materialSelect"))
    $("materialSelect").innerHTML = pelletMats.map((m) => `<option value="${m}">${m}</option>`).join("");
  if ($("briquetteSelect"))
    $("briquetteSelect").innerHTML = briqMats.map((m) => `<option value="${m}">${m}</option>`).join("");

  if (pelletMats.length && $("materialSelect")) $("materialSelect").value = pelletMats[0];
  if (briqMats.length && $("briquetteSelect")) $("briquetteSelect").value = briqMats[0];
}

/* ===========================
   REFRESH A STATE
   =========================== */
function refreshForState(state) {
  populateMaterials(state);
  buildTables(state);
  drawPelletChart();
  drawBriqChart();
  updateLastUpdated(state);
}

function updateLastUpdated(state) {
  const rows = rawData.filter((r) => r.State === state);
  const metaUpdated = rows.map((r) => r.UpdatedAt).filter(Boolean)[0] || niceDate(new Date());
  if ($("lastUpdated")) $("lastUpdated").textContent = `Last updated: ${metaUpdated}`;
}

/* ===========================
   TABLES
   =========================== */
function buildTables(state) {
  const rows = rawData.filter((r) => r.State === state);

  const pellets = rows.filter((r) => UC(r.Type) === "PELLET");
  const briqs = rows.filter((r) => UC(r.Type) === "BRIQUETTE");

  if ($("materialTable")) $("materialTable").innerHTML = renderTableHTML(pellets);
  if ($("briquetteTable")) $("briquetteTable").innerHTML = renderTableHTML(briqs);
}

function renderTableHTML(items) {
  if (!items.length) {
    return `<thead><tr><th>Material</th><th>Price (₹/ton)</th></tr></thead>
            <tbody><tr><td colspan="2">No data</td></tr></tbody>`;
  }
  const head = `<thead><tr><th>Material</th><th>Price (₹/ton)</th></tr></thead>`;
  const body = `<tbody>
    ${items
      .map(
        (r) => `<tr>
          <td>${escapeHTML(r.Material || "-")}</td>
          <td>₹${fmtINR(r.Price)}</td>
        </tr>`
      )
      .join("")}
  </tbody>`;
  return head + body;
}

function escapeHTML(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ===========================
   CHARTS
   =========================== */
function drawPelletChart() {
  const state = $("locationSelect")?.value;
  const mat = $("materialSelect")?.value;
  const row = rawData.find((r) => r.State === state && r.Material === mat && UC(r.Type) === "PELLET");

  if ($("chartTitle")) $("chartTitle").textContent = `Pellet Price Trend — ${mat || "-"}`;
  if ($("pelletTimestamp")) $("pelletTimestamp").textContent = `State: ${state}`;

  const series = seriesFromRow(row);
  chartPellet = drawLineChart(chartPellet, "priceChart", series, "#1C3D5A", "#DDEAF4");
}

function drawBriqChart() {
  const state = $("locationSelect")?.value;
  const mat = $("briquetteSelect")?.value;
  const row = rawData.find(
    (r) => r.State === state && r.Material === mat && UC(r.Type) === "BRIQUETTE"
  );

  if ($("briquetteChartTitle"))
    $("briquetteChartTitle").textContent = `Briquette Price Trend — ${mat || "-"}`;
  if ($("briquetteTimestamp")) $("briquetteTimestamp").textContent = `State: ${state}`;

  const series = seriesFromRow(row);
  chartBriq = drawLineChart(chartBriq, "briquetteChart", series, "#FFA500", "#FFEFD5");
}

function seriesFromRow(r) {
  const labels = ["Year", "6 Months", "Month", "Week"];
  const data = r ? [r.Year || 0, r.SixMonth || 0, r.Month || 0, r.Week || 0] : [0, 0, 0, 0];
  return { labels, data };
}

function drawLineChart(instance, canvasId, series, stroke, fill) {
  if (instance) instance.destroy();
  const canvas = $(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, fill);
  grad.addColorStop(1, "rgba(255,255,255,0)");

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: series.labels,
      datasets: [
        {
          label: "₹/ton",
          data: series.data,
          borderColor: stroke,
          backgroundColor: grad,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: stroke,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `₹${fmtINR(ctx.parsed.y)}/ton` } },
      },
      scales: {
        y: { ticks: { callback: (v) => `₹${fmtINR(v)}` }, beginAtZero: false },
        x: { grid: { display: false } },
      },
    },
  });
}

/* ===========================
   TOOLS: Freight, Fuel Compare, Submit/Call
   =========================== */

// Freight & Landed Cost
function initFreightTool() {
  $("fc-calc")?.addEventListener("click", calcFreight);
  $("fc-use-selected")?.addEventListener("click", useSelectedTableRate);
}

function calcFreight() {
  const qty = +$("fc-quantity")?.value || 0;       // tons
  const ex  = +$("fc-exfactory")?.value || 0;      // ₹/ton
  const km  = +$("fc-distance")?.value || 0;       // km

  const selected = $("fc-truck")?.value || "20|42"; // "capacity|defaultRate"
  const rateDefault = +(selected.split("|")[1] || 0);
  const rateCustom  = +$("fc-rate")?.value || 0;
  const ratePerKm   = rateCustom > 0 ? rateCustom : rateDefault;

  if (!qty || !ex || !km || !ratePerKm) {
    $("fc-freightTotal").textContent = "0";
    $("fc-landed").textContent = "0";
    return;
  }

  const freightTotal = km * ratePerKm;
  const landedPerTon = Math.round(((ex * qty) + freightTotal) / qty);

  $("fc-freightTotal").textContent = fmtINR(freightTotal);
  $("fc-landed").textContent = fmtINR(landedPerTon);
}

function useSelectedTableRate() {
  // Prefer the current pellet price from our live state
  if (window.MP?.getCurrentPelletPrice) {
    const p = window.MP.getCurrentPelletPrice();
    if (p) $("fc-exfactory").value = p;
  } else {
    // fallback: try to grab first numeric from table
    try {
      const table = $("materialTable");
      const cell = table?.querySelector("tbody td, tbody tr td:nth-child(2)");
      const txt = (cell?.textContent || "").replace(/[^\d]/g, "");
      if (txt) $("fc-exfactory").value = Number(txt);
    } catch (_) {}
  }
  calcFreight();
}

// Fuel Comparison (₹ per MMkcal)
function initFuelComparison() {
  $("fuel-recalc")?.addEventListener("click", recalcFuelTable);
  document.addEventListener("input", (e) => {
    if (e.target.closest?.("#fuelCompareTable")) recalcFuelTable();
  });
  // initial
  recalcFuelTable();
}

function recalcFuelTable() {
  const rows = document.querySelectorAll("#fuelCompareTable tbody tr");
  let best = { name: null, value: Infinity };

  rows.forEach((row) => {
    const name = row.cells[0].textContent.trim();
    const price = +row.querySelector(".fc-price").value || 0;   // ₹/ton
    const kcalPerKg = +row.querySelector(".fc-kcal").value || 0;

    const totalKcalPerTon = kcalPerKg * 1000; // 1 ton = 1000 kg
    const costPerMMkcal = totalKcalPerTon ? (price / (totalKcalPerTon / 1_000_000)) : 0;

    row.querySelector(".fc-result").textContent = costPerMMkcal ? `₹${costPerMMkcal.toFixed(0)}` : "—";

    if (costPerMMkcal && costPerMMkcal < best.value) best = { name, value: costPerMMkcal };
  });

  const bestEl = $("fuel-best");
  if (!bestEl) return;
  if (best.name) {
    bestEl.textContent = `Best value: ${best.name} · ₹${best.value.toFixed(0)} per MMkcal`;
    bestEl.classList.add("show");
  } else {
    bestEl.textContent = "Best value: —";
    bestEl.classList.remove("show");
  }
}

// Submit Price + Call for Best Rates
function initSubmitAndCall() {
  $("priceForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const state = $("sp-state").value.trim();
    const city = $("sp-city").value.trim();
    const material = $("sp-material").value;
    const price = $("sp-price").value.trim();
    const qty = $("sp-qty").value.trim();

    const msg = [
      "New Market Price (Peltra)",
      `State/Region: ${state}`,
      city ? `City/Cluster: ${city}` : null,
      `Material: ${material}`,
      `Price: ₹${price}/ton`,
      qty ? `Quantity: ${qty} tons` : null,
    ].filter(Boolean).join("%0A");

    // TODO: put your real WhatsApp number (country code + number, no '+')
    const whatsappNumber = "919999999999";
    window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, "_blank");
  });

  $("call-best")?.addEventListener("click", () => {
    // TODO: replace with your real numbers
    const phone = "tel:+919999999999";
    const wa = "https://wa.me/919999999999?text=Hi%20Peltra%2C%20I%20want%20best%20rates%20for%20biofuel.";
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      window.location.href = phone; // mobile: phone call
    } else {
      window.open(wa, "_blank");    // desktop: WhatsApp web
    }
  });
}

/* ===========================
   UTIL for tools
   =========================== */
function getFirstPriceFor(typeName) {
  const state = $("locationSelect")?.value;
  const rows = rawData.filter((r) => r.State === state && UC(r.Type) === UC(typeName));
  return rows[0]?.Price || 0;
}