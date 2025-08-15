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
    const price = parseInt((row.Week ?? "0").toString().replace(/,/g, ''));
    const trend = [
      parseInt(row.Year || 0),
      parseInt(row["6 Month"] || row["6 Months"] || 0),
      parseInt(row.Month || 0),
      parseInt(row.Week || 0)
    ];

    if (!location || !material || !type) continue;

    if (!structured[location]) {
      structured[location] = { materials: { pellets: {}, briquettes: {} } };
    }

    const formatted = { price, trend };

    if (type.toLowerCase() === "pellet") {
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
  const pelletToggleWrap = document.getElementById("pelletToggleWrap") || materialTable.parentElement;
  const briqToggleWrap   = document.getElementById("briquetteToggleWrap") || briquetteTable.parentElement;

  const ctx          = document.getElementById("priceChart").getContext("2d");
  const briquetteCtx = document.getElementById("briquetteChart").getContext("2d");

  const { structured: dataset, pelletLabels, briquetteLabels } = await loadData();
  pelletLabels.delete("GLOBAL");
  briquetteLabels.delete("GLOBAL");

  const locations = Object.keys(dataset).filter(loc => loc.toUpperCase() !== "GLOBAL");

  // Populate dropdowns
  locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = loc;
    locationSelect.appendChild(opt);
  });
  pelletLabels.forEach(mat => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = mat;
    materialSelect.appendChild(opt);
  });
  briquetteLabels.forEach(mat => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = mat;
    briquetteSelect.appendChild(opt);
  });

  // Charts
  const baseChartOpts = {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [], borderColor:'#168aad', backgroundColor:'#e8f6f7', tension:0.25, pointRadius:3 }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `₹${c.parsed.y.toLocaleString('en-IN')}` } }
      },
      scales: {
        y: {
          ticks: { callback: v => `₹${Number(v).toLocaleString('en-IN')}` }
        }
      }
    }
  };
  const chart         = new Chart(ctx,          JSON.parse(JSON.stringify(baseChartOpts)));
  const briquetteChart= new Chart(briquetteCtx, JSON.parse(JSON.stringify(baseChartOpts)));

  // ------- Collapsible table helpers -------
  const ROW_LIMIT = 2;

  function rowsHTML(entries, barColor) {
    return entries.map(([type, { price, trend }], i) => {
      const hiddenClass = i >= ROW_LIMIT ? "is-hidden" : "";
      const trendHTML = trend.map(val =>
        `<span class="spark-bar" style="height:${10 + (Number(val)||0)/100}px; background:${barColor}"></span>`
      ).join("");
      return `
        <tr class="${hiddenClass}">
          <td>${type}</td>
          <td><strong>₹${(Number(price)||0).toLocaleString('en-IN')}</strong></td>
          <td class="trend-cell">${trendHTML}</td>
        </tr>`;
    }).join("");
  }

  function renderTable(locationKey, expandedPellets=false) {
    const data = dataset[locationKey].materials.pellets;
    const entries = Object.entries(data);
    const hasMore = entries.length > ROW_LIMIT;

    materialTable.innerHTML = `
      <tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>
      ${rowsHTML(entries, '#52b788')}
    `;

    // Toggle button
    const existing = pelletToggleWrap.querySelector('[data-toggle="pellet"]');
    if (existing) existing.remove();
    if (hasMore) {
      const btn = document.createElement('button');
      btn.className = 'btn show-toggle';
      btn.dataset.toggle = 'pellet';
      btn.textContent = expandedPellets ? 'Show less' : `Show all (${entries.length})`;
      pelletToggleWrap.appendChild(btn);
      setExpanded(materialTable, expandedPellets);
    }
  }

  function renderBriquetteTable(locationKey, expandedBriq=false) {
    const data = dataset[locationKey].materials.briquettes;
    const entries = Object.entries(data);
    const hasMore = entries.length > ROW_LIMIT;

    briquetteTable.innerHTML = `
      <tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>
      ${rowsHTML(entries, '#6a4f2d')}
    `;

    const existing = briqToggleWrap.querySelector('[data-toggle="briq"]');
    if (existing) existing.remove();
    if (hasMore) {
      const btn = document.createElement('button');
      btn.className = 'btn show-toggle';
      btn.dataset.toggle = 'briq';
      btn.textContent = expandedBriq ? 'Show less' : `Show all (${entries.length})`;
      briqToggleWrap.appendChild(btn);
      setExpanded(briquetteTable, expandedBriq);
    }
  }

  function setExpanded(tableEl, expand) {
    tableEl.querySelectorAll('tr.is-hidden').forEach(tr => {
      tr.style.display = expand ? 'table-row' : 'none';
    });
  }

  // ------- Chart + specs -------
  function updateChart(locationKey, type, chartObj, isPellet = true) {
    const source = isPellet ? dataset[locationKey].materials.pellets
                            : dataset[locationKey].materials.briquettes;
    const trend  = source[type]?.trend || [];
    chartObj.data.datasets[0].label = type;
    chartObj.data.datasets[0].data  = trend;
    chartObj.update();

    updateSpecs(type, isPellet);
  }

  function updateSpecs(material, isPellet = true) {
    const specContainerId = isPellet ? "pelletSpecs" : "briquetteSpecs";
    const timestampId     = isPellet ? "pelletTimestamp" : "briquetteTimestamp";

    const globalInfo = sheetData.find(row =>
      row.State?.trim().toLowerCase() === "global" &&
      row.Material?.trim() === material &&
      row.Type?.trim().toLowerCase().includes(isPellet ? "pellet" : "briquette")
    );

    if (globalInfo) {
      document.getElementById(specContainerId).innerHTML = `
        <p><strong>Ash:</strong> ${globalInfo.Ash || '--'}%</p>
        <p><strong>Moisture:</strong> ${globalInfo.Moisture || '--'}%</p>
        <p><strong>Kcal Value:</strong> ${globalInfo.Kcal || '--'}</p>
      `;
    }

    const lastRow = sheetData.find(row => row["Last Updated"]);
    if (lastRow) document.getElementById(timestampId).textContent = lastRow["Last Updated"];
  }

  function updateMaterialDropdowns(locationKey) {
    materialSelect.innerHTML = "";
    briquetteSelect.innerHTML = "";

    Object.keys(dataset[locationKey].materials.pellets).forEach(mat => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = mat;
      materialSelect.appendChild(opt);
    });
    Object.keys(dataset[locationKey].materials.briquettes).forEach(mat => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = mat;
      briquetteSelect.appendChild(opt);
    });
  }

  // Keep toggle state per section when location changes
  let pelletsExpanded   = false;
  let briquettesExpanded= false;

  function refreshAll() {
    const loc = locationSelect.value;

    updateMaterialDropdowns(loc);
    renderTable(loc, pelletsExpanded);
    renderBriquetteTable(loc, briquettesExpanded);

    const defaultPellet    = materialSelect.options[0]?.value;
    const defaultBriquette = briquetteSelect.options[0]?.value;

    if (defaultPellet)    updateChart(loc, defaultPellet, chart, true);
    if (defaultBriquette) updateChart(loc, defaultBriquette, briquetteChart, false);
  }

  // Wire selectors
  locationSelect.addEventListener("change", () => {
    pelletsExpanded = false;
    briquettesExpanded = false;
    refreshAll();
  });
  materialSelect.addEventListener("change", () =>
    updateChart(locationSelect.value, materialSelect.value, chart, true)
  );
  briquetteSelect.addEventListener("change", () =>
    updateChart(locationSelect.value, briquetteSelect.value, briquetteChart, false)
  );

  // Toggle handlers (event delegation)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;

    const kind = btn.dataset.toggle; // 'pellet' | 'briq'
    if (kind === 'pellet') {
      pelletsExpanded = !pelletsExpanded;
      setExpanded(materialTable, pelletsExpanded);
      btn.textContent = pelletsExpanded ? 'Show less' : `Show all (${materialTable.querySelectorAll('tr').length - 1})`;
    } else {
      briquettesExpanded = !briquettesExpanded;
      setExpanded(briquetteTable, briquettesExpanded);
      btn.textContent = briquettesExpanded ? 'Show less' : `Show all (${briquetteTable.querySelectorAll('tr').length - 1})`;
    }
  });

  // Defaults
  locationSelect.value  = locations[0];
  materialSelect.value  = [...pelletLabels][0] || "";
  briquetteSelect.value = [...briquetteLabels][0] || "";
  refreshAll();
});

// ==============================
// FREIGHT CALCULATOR (standalone)
// ==============================
function formatINR(n) { return `₹${Number(n).toLocaleString('en-IN')}`; }

function calcFreight() {
  const d    = Number(document.getElementById('fc-distance').value || 0);
  const qty  = Number(document.getElementById('fc-qty').value || 0);
  const base = Number(document.getElementById('fc-base').value || 0);
  if (d <= 0 || qty <= 0 || base < 0) { alert('Please enter valid Distance, Quantity, and Freight Base.'); return; }
  const totalFreight = d * base;
  const perTon = totalFreight / qty;
  document.getElementById('fc-total').textContent  = formatINR(totalFreight);
  document.getElementById('fc-perton').textContent = `${formatINR(perTon)}/ton`;
  document.getElementById('fc-results').hidden = false;
}
function resetFreight() {
  ['fc-distance','fc-qty','fc-base'].forEach(id => document.getElementById(id).value = '');
  const t = document.getElementById('fc-truck'); if (t) t.selectedIndex = 0;
  document.getElementById('fc-results').hidden = true;
}
document.addEventListener('DOMContentLoaded', () => {
  const c = document.getElementById('fc-calc');
  const r = document.getElementById('fc-reset');
  if (c && r) { c.addEventListener('click', calcFreight); r.addEventListener('click', resetFreight); }
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
    if (!payload.material || !payload.price) { alert("Please enter Material and Price."); return; }

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