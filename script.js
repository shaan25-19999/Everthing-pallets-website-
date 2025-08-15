// ==========================
// DATA LOAD & STRUCTURING
// ==========================
const SHEET_URL = "https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf"; // your live sheet
let sheetData = [];

const loadData = async () => {
  const res = await fetch(SHEET_URL, { cache: "no-store" });
  sheetData = await res.json();

  const structured = {};
  const pelletLabels = new Set();
  const briquetteLabels = new Set();

  for (const row of sheetData) {
    const location = (row.State ?? "").trim();
    const material = (row.Material ?? "").trim();
    const type     = (row.Type ?? "").trim().toLowerCase();

    const trend = [
      parseInt((row.Year ?? "0").toString().replace(/,/g,"")) || 0,
      parseInt((row["6 Month"] ?? "0").toString().replace(/,/g,"")) || 0,
      parseInt((row.Month ?? "0").toString().replace(/,/g,"")) || 0,
      parseInt((row.Week ?? "0").toString().replace(/,/g,"")) || 0,
    ];
    const price = trend[3];

    if (!location || !material || !type) continue;

    if (!structured[location]) {
      structured[location] = { materials: { pellets: {}, briquettes: {} } };
    }
    const bucket = type.includes("pellet") ? "pellets" : "briquettes";
    structured[location].materials[bucket][material] = { price, trend };

    if (bucket === "pellets") pelletLabels.add(material);
    else briquetteLabels.add(material);
  }

  return { structured, pelletLabels, briquetteLabels };
};

// ==========================
// UI HELPERS
// ==========================
const fmtINR = (n) => Number(n || 0).toLocaleString("en-IN");

function trendBars(arr, color = '#2FA66A') {
  const nums = arr.map(n => Number(n) || 0);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return nums.map(v => {
    const h = max > min ? 18 + ((v - min) / (max - min)) * 26 : 28; // 18–44px
    return `<span style="display:inline-block;width:6px;height:${h}px;background:${color};border-radius:2px;margin:0 2px;"></span>`;
  }).join('');
}

function deltaChip(current, month, el) {
  if (!el) return;
  const cur = Number(current || 0);
  const mon = Number(month   || 0);
  if (!cur || !mon) { el.textContent = "—"; el.className = "delta chip chip-muted"; return; }
  const diff = cur - mon;
  const pct = mon ? Math.round((diff/mon)*100) : 0;
  if (diff > 0) {
    el.textContent = `▲ +${fmtINR(diff)} vs Month (${pct}%)`;
    el.className = "delta chip chip-up";
  } else if (diff < 0) {
    el.textContent = `▼ ${fmtINR(diff)} vs Month (${pct}%)`;
    el.className = "delta chip chip-down";
  } else {
    el.textContent = "— no change vs Month";
    el.className = "delta chip chip-muted";
  }
}

// ==========================
// PAGE BOOTSTRAP
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  // DOM
  const locationSelect  = document.getElementById("locationSelect");
  const materialSelect  = document.getElementById("materialSelect");
  const briquetteSelect = document.getElementById("briquetteSelect");
  const materialTable   = document.getElementById("materialTable");
  const briquetteTable  = document.getElementById("briquetteTable");

  const pelletPriceEl   = document.getElementById("pelletPrice");
  const briqPriceEl     = document.getElementById("briquettePrice");
  const pelletDeltaEl   = document.getElementById("pelletDelta");
  const briqDeltaEl     = document.getElementById("briquetteDelta");

  const ctx             = document.getElementById("priceChart")?.getContext("2d");
  const briquetteCtx    = document.getElementById("briquetteChart")?.getContext("2d");

  // Load & structure
  const { structured: dataset, pelletLabels, briquetteLabels } = await loadData();

  // Locations (skip GLOBAL)
  const locations = Object.keys(dataset).filter(l => (l||"").toUpperCase() !== "GLOBAL");

  // Preselect via query (?region=&material=)
  const params = new URLSearchParams(location.search);
  const deepRegion   = params.get("region");
  const deepMaterial = params.get("material");

  // Preferred state
  const saved = localStorage.getItem("preferredState");

  // Fill location list
  locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = loc;
    locationSelect.appendChild(opt);
  });

  // Choose initial location
  if (deepRegion && locations.includes(deepRegion)) {
    locationSelect.value = deepRegion;
  } else if (saved && locations.includes(saved)) {
    locationSelect.value = saved;
  } else {
    locationSelect.value = locations[0];
  }

  // Charts
  const baseChartOpts = {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [], tension: 0.35, borderWidth: 2, pointRadius: 3 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `₹${(c.parsed.y ?? 0).toLocaleString('en-IN')}` } }
      },
      scales: {
        y: { ticks: { callback: v => `₹${Number(v).toLocaleString('en-IN')}` } }
      }
    }
  };
  const chart = ctx ? new Chart(ctx, structuredClone(baseChartOpts)) : null;
  const briquetteChart = briquetteCtx ? new Chart(briquetteCtx, structuredClone(baseChartOpts)) : null;

  // Show/Hide toggles
  let pelletCollapsed = true;
  let briqCollapsed   = true;

  // Dropdown builders for selected location
  function updateMaterialDropdowns(loc) {
    materialSelect.innerHTML = "";
    briquetteSelect.innerHTML = "";

    const pel = Object.keys(dataset[loc]?.materials?.pellets || {});
    const bri = Object.keys(dataset[loc]?.materials?.briquettes || {});

    pel.forEach(m => { const o = document.createElement("option"); o.value=o.textContent=m; materialSelect.appendChild(o); });
    bri.forEach(m => { const o = document.createElement("option"); o.value=o.textContent=m; briquetteSelect.appendChild(o); });

    // Deep-link preferred material
    if (deepMaterial && pel.includes(deepMaterial)) materialSelect.value = deepMaterial;
  }

  // Specs + timestamp from GLOBAL row for the chosen material
  function updateSpecs(material, isPellet) {
    const specContainerId = isPellet ? "pelletSpecs" : "briquetteSpecs";
    const timestampId     = isPellet ? "pelletTimestamp" : "briquetteTimestamp";

    const globalInfo = sheetData.find(row =>
      (row.State ?? '').trim().toLowerCase() === "global" &&
      (row.Material ?? '').trim() === material &&
      (row.Type ?? '').trim().toLowerCase().includes(isPellet ? "pellet" : "briquette")
    );

    const container = document.getElementById(specContainerId);
    if (container && globalInfo) {
      container.innerHTML = `
        <p><strong>Ash:</strong> ${globalInfo.Ash ?? '--'}%</p>
        <p><strong>Moisture:</strong> ${globalInfo.Moisture ?? '--'}%</p>
        <p><strong>Kcal:</strong> ${globalInfo.Kcal ?? '--'}</p>
      `;
    }

    const lastRow = sheetData.find(r => r["Last Updated"]);
    const tsEl = document.getElementById(timestampId);
    if (lastRow && tsEl) tsEl.textContent = lastRow["Last Updated"];
  }

  // Summary card values + delta vs Month
  function updateCards(loc, pelMat, briMat) {
    const p = dataset[loc]?.materials?.pellets?.[pelMat]?.trend || [0,0,0,0];
    const b = dataset[loc]?.materials?.briquettes?.[briMat]?.trend || [0,0,0,0];

    // set prices
    pelletPriceEl.textContent = fmtINR(p[3]);
    briqPriceEl.textContent   = fmtINR(b[3]);

    // delta vs Month
    deltaChip(p[3], p[2], pelletDeltaEl);
    deltaChip(b[3], b[2], briqDeltaEl);
  }

  // Charts
  function updateChart(loc, material, chartObj, isPellet) {
    if (!chartObj) return;
    const src = isPellet ? dataset[loc]?.materials?.pellets : dataset[loc]?.materials?.briquettes;
    const series = src?.[material]?.trend || [];
    chartObj.data.datasets[0].label = material || '';
    chartObj.data.datasets[0].data  = series;
    chartObj.update();
    updateSpecs(material, isPellet);
  }

  // Tables (with Show all)
  function renderPelletTable(loc) {
    const all = Object.entries(dataset[loc]?.materials?.pellets || {});
    const rows = pelletCollapsed ? all.slice(0,2) : all;
    materialTable.innerHTML =
      `<tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      rows.map(([name, obj]) => `
        <tr>
          <td>${name}</td>
          <td><strong>₹${fmtINR(obj.price)}</strong></td>
          <td>${trendBars(obj.trend, '#2FA66A')}</td>
        </tr>
      `).join('');
    document.getElementById("pelletToggleBtn").textContent = pelletCollapsed ? "Show all" : "Show less";
  }
  function renderBriquetteTable(loc) {
    const all = Object.entries(dataset[loc]?.materials?.briquettes || {});
    const rows = briqCollapsed ? all.slice(0,2) : all;
    briquetteTable.innerHTML =
      `<tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      rows.map(([name, obj]) => `
        <tr>
          <td>${name}</td>
          <td><strong>₹${fmtINR(obj.price)}</strong></td>
          <td>${trendBars(obj.trend, '#3B7A57')}</td>
        </tr>
      `).join('');
    document.getElementById("briquetteToggleBtn").textContent = briqCollapsed ? "Show all" : "Show less";
  }

  // One-shot refresh for selected location
  function refreshAll() {
    const loc = locationSelect.value;
    localStorage.setItem("preferredState", loc);

    updateMaterialDropdowns(loc);

    const pelMat = materialSelect.options[0]?.value;
    const briMat = briquetteSelect.options[0]?.value;

    if (pelMat) updateChart(loc, pelMat, chart, true);
    if (briMat) updateChart(loc, briMat, briquetteChart, false);

    updateCards(loc, pelMat, briMat);
    renderPelletTable(loc);
    renderBriquetteTable(loc);
  }

  // Init
  refreshAll();

  // Events
  locationSelect.addEventListener("change", () => { pelletCollapsed = true; briqCollapsed = true; refreshAll(); });
  materialSelect.addEventListener("change", () => updateChart(locationSelect.value, materialSelect.value, chart, true));
  briquetteSelect.addEventListener("change", () => updateChart(locationSelect.value, briquetteSelect.value, briquetteChart, false));

  document.getElementById("pelletToggleBtn").addEventListener("click", () => { pelletCollapsed = !pelletCollapsed; renderPelletTable(locationSelect.value); });
  document.getElementById("briquetteToggleBtn").addEventListener("click", () => { briqCollapsed = !briqCollapsed; renderBriquetteTable(locationSelect.value); });
});

// ==============================
// FREIGHT CALCULATOR
// ==============================
const formatINR = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function calcFreight() {
  const d   = Number(document.getElementById('fc-distance')?.value || 0);
  const qty = Number(document.getElementById('fc-qty')?.value || 0);
  const base= Number(document.getElementById('fc-base')?.value || 0);

  if (d <= 0 || qty <= 0 || base < 0) {
    alert('Please enter valid Distance, Quantity, and Freight Base.');
    return;
  }
  const totalFreight = d * base;
  const perTon = totalFreight / qty;

  document.getElementById('fc-total').textContent  = formatINR(totalFreight);
  document.getElementById('fc-perton').textContent = `${formatINR(perTon)}/ton`;
  document.getElementById('fc-results').hidden = false;
}
function resetFreight() {
  ['fc-distance','fc-qty','fc-base'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const r = document.getElementById('fc-results'); if (r) r.hidden = true;
}
document.addEventListener('DOMContentLoaded', () => {
  const calcBtn  = document.getElementById('fc-calc');
  const resetBtn = document.getElementById('fc-reset');
  if (calcBtn)  calcBtn.addEventListener('click', calcFreight);
  if (resetBtn) resetBtn.addEventListener('click', resetFreight);
});

// =======================================
// SUBMIT YOUR OWN PRICE (Netlify Forms)
// =======================================
(() => {
  const form = document.querySelector('form[name="price-submissions"]');
  const feed = document.getElementById('submitFeed');
  if (!form || !feed) return;

  const toURLEncoded = (data) =>
    Object.keys(data).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(data[k])).join("&");

  function addToFeed(item){
    const card = document.createElement('div');
    card.className = 'feed-item';
    card.innerHTML = `
      <div class="feed-top">${item.material} • ₹${Number(item.price).toLocaleString('en-IN')}/ton</div>
      <div class="feed-mid">${item.city} • ${item.quantity} tons</div>
      ${item.notes ? `<div class="feed-notes">${item.notes}</div>` : ''}
      <div class="feed-time">${new Date().toLocaleString('en-IN')}</div>
    `;
    feed.prepend(card);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      "form-name": form.getAttribute("name"),
      material: form.material.value.trim(),
      price: form.price.value,
      quantity: form.quantity.value,
      city: form.city.value.trim(),
      notes: form.notes.value.trim(),
    };

    if (!payload.material || !payload.price) {
      alert("Please enter Material and Price.");
      return;
    }

    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: toURLEncoded(payload)
      });

      addToFeed(payload);
      form.reset();
      form.material.focus();
    } catch (err) {
      console.error(err);
      alert("Could not submit right now. Please try again.");
    }
  });
})();