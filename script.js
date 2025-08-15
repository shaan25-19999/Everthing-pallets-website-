// ✅ Fetch live JSON from Google Sheets (via Sheet.best)
let sheetData = [];

const loadData = async () => {
  const res = await fetch("https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf");
  sheetData = await res.json();

  const structured = {};
  const pelletLabels = new Set();
  const briquetteLabels = new Set();

  for (const row of sheetData) {
    const location = row.State?.trim();
    const material = row.Material?.trim();
    const type = row.Type?.trim();
    const price = parseInt((row.Week ?? "0").toString().replace(/,/g, '')) || 0;
    const trend = [
      parseInt(row.Year ?? "0"),
      parseInt(row["6 Month"] ?? "0"),
      parseInt(row.Month ?? "0"),
      parseInt(row.Week ?? "0")
    ];

    if (!location || !material || !type) continue;

    if (!structured[location]) {
      structured[location] = { materials: { pellets: {}, briquettes: {} } };
    }

    const formatted = { price, trend };

    if ((type || "").toLowerCase() === "pellet") {
      structured[location].materials.pellets[material] = formatted;
      pelletLabels.add(material);
    } else {
      structured[location].materials.briquettes[material] = formatted;
      briquetteLabels.add(material);
    }
  }

  return { structured, pelletLabels, briquetteLabels };
};

document.addEventListener("DOMContentLoaded", async () => {
  const locationSelect   = document.getElementById("locationSelect");
  const materialSelect   = document.getElementById("materialSelect");
  const briquetteSelect  = document.getElementById("briquetteSelect");
  const materialTable    = document.getElementById("materialTable");
  const briquetteTable   = document.getElementById("briquetteTable");
  const ctx              = document.getElementById("priceChart")?.getContext("2d");
  const briquetteCtx     = document.getElementById("briquetteChart")?.getContext("2d");

  const { structured: dataset, pelletLabels, briquetteLabels } = await loadData();

  // Remove GLOBAL buckets from dropdowns
  pelletLabels.delete("GLOBAL");
  briquetteLabels.delete("GLOBAL");

  // Build Location list (skip GLOBAL if present)
  const locations = Object.keys(dataset).filter(loc => (loc || "").toUpperCase() !== "GLOBAL");

  locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  });

  // Preload “all materials” options (first load; they’ll be replaced when location changes)
  pelletLabels.forEach(mat => {
    const opt = document.createElement("option");
    opt.value = mat;
    opt.textContent = mat;
    materialSelect.appendChild(opt);
  });
  briquetteLabels.forEach(mat => {
    const opt = document.createElement("option");
    opt.value = mat;
    opt.textContent = mat;
    briquetteSelect.appendChild(opt);
  });

  // ===== Charts =====
  const baseChartOpts = {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [], tension: 0.3, borderWidth: 2, pointRadius: 3 }] },
    options: {
      responsive: true,
      plugins: { tooltip: { callbacks: { label: c => `₹${(c.parsed.y ?? 0).toLocaleString('en-IN')}` } } },
      scales: { y: { ticks: { callback: v => `₹${Number(v).toLocaleString('en-IN')}` } } }
    }
  };

  const chart = ctx ? new Chart(ctx, baseChartOpts) : null;
  const briquetteChart = briquetteCtx ? new Chart(briquetteCtx, baseChartOpts) : null;

  // ===== Mini-trend bars =====
  function trendBars(arr, color = '#52b788') {
    const nums = arr.map(n => Number(n) || 0);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return nums.map(v => {
      const h = max > min ? 18 + ((v - min) / (max - min)) * 26 : 28; // 18–44px
      return `<span style="display:inline-block;width:6px;height:${h}px;background:${color};border-radius:2px;margin:0 2px;"></span>`;
    }).join('');
  }

  // ===== Show All/Show Less state =====
  let showAllPellets = false;
  let showAllBriquettes = false;
  const ROW_LIMIT = 2;

  function buildRows(entries, limit, color) {
    return entries.slice(0, limit).map(([type, { price, trend }]) => `
      <tr>
        <td>${type}</td>
        <td><strong>₹${Number(price).toLocaleString('en-IN')}</strong></td>
        <td>${trendBars(trend, color)}</td>
      </tr>
    `).join('');
  }

  function addOrUpdateToggleBtn(parentEl, isPellet, total, showingAll, onToggle) {
    // remove any existing toggle in this card
    const old = parentEl.querySelector('.show-toggle');
    if (old) old.remove();
    if (total <= ROW_LIMIT) return;

    const btn = document.createElement('button');
    btn.className = 'btn ghost show-toggle';
    btn.style.margin = '10px 0 0';
    btn.textContent = showingAll ? 'Show Less' : `Show All (${total})`;
    btn.addEventListener('click', onToggle);
    parentEl.appendChild(btn);
  }

  // ===== Tables (with toggles) =====
  function renderTable(locationKey) {
    const data = dataset[locationKey]?.materials?.pellets || {};
    const entries = Object.entries(data);
    const limit = showAllPellets ? entries.length : ROW_LIMIT;

    materialTable.innerHTML =
      `<tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      buildRows(entries, limit, '#2FA66A');

    addOrUpdateToggleBtn(
      materialTable.parentElement,
      true,
      entries.length,
      showAllPellets,
      () => { showAllPellets = !showAllPellets; renderTable(locationKey); }
    );
  }

  function renderBriquetteTable(locationKey) {
    const data = dataset[locationKey]?.materials?.briquettes || {};
    const entries = Object.entries(data);
    const limit = showAllBriquettes ? entries.length : ROW_LIMIT;

    briquetteTable.innerHTML =
      `<tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      buildRows(entries, limit, '#3B7A57');

    addOrUpdateToggleBtn(
      briquetteTable.parentElement,
      false,
      entries.length,
      showAllBriquettes,
      () => { showAllBriquettes = !showAllBriquettes; renderBriquetteTable(locationKey); }
    );
  }

  function updateChart(locationKey, type, chartObj, isPellet = true) {
    if (!chartObj) return;
    const source = isPellet ? dataset[locationKey]?.materials?.pellets : dataset[locationKey]?.materials?.briquettes;
    const trend = source?.[type]?.trend || [];
    chartObj.data.datasets[0].label = type || '';
    chartObj.data.datasets[0].data = trend;
    chartObj.update();
    updateSpecs(type, isPellet);
  }

  // ===== Specs + timestamp (from GLOBAL rows) =====
  function updateSpecs(material, isPellet = true) {
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
        <p><strong>Kcal Value:</strong> ${globalInfo.Kcal ?? '--'}</p>
      `;
    }

    const lastRow = sheetData.find(row => row["Last Updated"]);
    const tsEl = document.getElementById(timestampId);
    if (lastRow && tsEl) tsEl.textContent = lastRow["Last Updated"];
  }

  // ===== Keep dropdowns in sync with selected location =====
  function updateMaterialDropdowns(locationKey) {
    materialSelect.innerHTML = "";
    briquetteSelect.innerHTML = "";

    const pelletMaterials = Object.keys(dataset[locationKey]?.materials?.pellets || {});
    pelletMaterials.forEach(mat => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = mat;
      materialSelect.appendChild(opt);
    });

    const briquetteMaterials = Object.keys(dataset[locationKey]?.materials?.briquettes || {});
    briquetteMaterials.forEach(mat => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = mat;
      briquetteSelect.appendChild(opt);
    });
  }

  // ===== One-shot refresh =====
  function refreshAll() {
    const loc = locationSelect.value;

    // reset toggles on location change
    showAllPellets = false;
    showAllBriquettes = false;

    updateMaterialDropdowns(loc);
    renderTable(loc);
    renderBriquetteTable(loc);

    const defaultPellet     = materialSelect.options[0]?.value;
    const defaultBriquette  = briquetteSelect.options[0]?.value;

    if (defaultPellet)    updateChart(loc, defaultPellet, chart, true);
    if (defaultBriquette) updateChart(loc, defaultBriquette, briquetteChart, false);
  }

  // Init selections + render
  locationSelect.value = locations[0];
  refreshAll();

  // Events
  locationSelect.addEventListener("change", refreshAll);
  materialSelect.addEventListener("change", () => updateChart(locationSelect.value, materialSelect.value, chart, true));
  briquetteSelect.addEventListener("change", () => updateChart(locationSelect.value, briquetteSelect.value, briquetteChart, false));
});


// ==============================
// FREIGHT CALCULATOR (standalone)
// ==============================
function formatINR(n) { return `₹${Number(n).toLocaleString('en-IN')}`; }

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
  const sel = document.getElementById('fc-truck');
  if (sel) sel.selectedIndex = 0;
  const r = document.getElementById('fc-results');
  if (r) r.hidden = true;
}

document.addEventListener('DOMContentLoaded', () => {
  const calcBtn  = document.getElementById('fc-calc');
  const resetBtn = document.getElementById('fc-reset');
  if (calcBtn && resetBtn) {
    calcBtn.addEventListener('click', calcFreight);
    resetBtn.addEventListener('click', resetFreight);
  }
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