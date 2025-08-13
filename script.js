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
    const price = parseInt(row.Week?.toString().replace(/,/g, ''));
    const trend = [
      parseInt(row.Year), 
      parseInt(row["6 Month"]), 
      parseInt(row.Month), 
      parseInt(row.Week)
    ];

    if (!structured[location]) {
      structured[location] = {
        materials: { pellets: {}, briquettes: {} }
      };
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
  const locationSelect = document.getElementById("locationSelect");
  const materialSelect = document.getElementById("materialSelect");
  const briquetteSelect = document.getElementById("briquetteSelect");
  const materialTable = document.getElementById("materialTable");
  const briquetteTable = document.getElementById("briquetteTable");
  const ctx = document.getElementById("priceChart").getContext("2d");
  const briquetteCtx = document.getElementById("briquetteChart").getContext("2d");

  const { structured: dataset, pelletLabels, briquetteLabels } = await loadData();
   pelletLabels.delete("GLOBAL");
   briquetteLabels.delete("GLOBAL");
  const locations = Object.keys(dataset).filter(loc => loc.toUpperCase() !== "GLOBAL");

  locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  });

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

  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [] }] },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `₹${ctx.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: val => `₹${val.toLocaleString()}`
          }
        }
      }
    }
  });

  const briquetteChart = new Chart(briquetteCtx, {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [] }] },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `₹${ctx.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: val => `₹${val.toLocaleString()}`
          }
        }
      }
    }
  });

  function renderTable(locationKey) {
    const data = dataset[locationKey].materials.pellets;
    materialTable.innerHTML = `<tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      Object.entries(data).map(([type, { price, trend }]) => {
        const trendHTML = trend.map(val =>
          `<span style="display:inline-block;width:5px;height:${10 + val / 100}px;background:#52b788;margin:0 1px;"></span>`).join('');
        return `<tr><td>${type}</td><td><strong>₹${price.toLocaleString()}</strong></td><td>${trendHTML}</td></tr>`;
      }).join('');
  }

  function renderBriquetteTable(locationKey) {
    const data = dataset[locationKey].materials.briquettes;
    briquetteTable.innerHTML = `<tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      Object.entries(data).map(([type, { price, trend }]) => {
        const trendHTML = trend.map(val =>
          `<span style="display:inline-block;width:5px;height:${10 + val / 100}px;background:#6a4f2d;margin:0 1px;"></span>`).join('');
        return `<tr><td>${type}</td><td><strong>₹${price.toLocaleString()}</strong></td><td>${trendHTML}</td></tr>`;
      }).join('');
  }

  function updateChart(locationKey, type, chartObj, isPellet = true) {
    const source = isPellet ? dataset[locationKey].materials.pellets : dataset[locationKey].materials.briquettes;
    const trend = source[type]?.trend || [];
    chartObj.data.datasets[0].label = type;
    chartObj.data.datasets[0].data = trend;
    chartObj.update();

    updateSpecs(type, isPellet);
  }

  function updateSpecs(material, isPellet = true) {
    const specContainerId = isPellet ? "pelletSpecs" : "briquetteSpecs";
    const timestampId = isPellet ? "pelletTimestamp" : "briquetteTimestamp";

    const globalInfo = sheetData.find(row =>
      row.State?.trim().toLowerCase() === "global" &&
      row.Material?.trim() === material &&
      row.Type?.trim().toLowerCase().includes(isPellet ? "pellet" : "briquette")
    );

    if (globalInfo) {
      const container = document.getElementById(specContainerId);
      container.innerHTML = `
     
       <p><strong>Ash:</strong> ${globalInfo.Ash || '--'}%</p>
       <p><strong>Moisture:</strong> ${globalInfo.Moisture || '--'}%</p>
        <p><strong>Kcal Value:</strong> ${globalInfo.Kcal || '--'}</p>
      `;
    }

    const lastRow = sheetData.find(row => row["Last Updated"]);
    if (lastRow) {
      document.getElementById(timestampId).textContent = lastRow["Last Updated"];
    }
  }
  function updateMaterialDropdowns(locationKey) {
  materialSelect.innerHTML = "";
  briquetteSelect.innerHTML = "";

  const pelletMaterials = Object.keys(dataset[locationKey].materials.pellets);
  pelletMaterials.forEach(mat => {
    const opt = document.createElement("option");
    opt.value = mat;
    opt.textContent = mat;
    materialSelect.appendChild(opt);
  });

  const briquetteMaterials = Object.keys(dataset[locationKey].materials.briquettes);
  briquetteMaterials.forEach(mat => {
    const opt = document.createElement("option");
    opt.value = mat;
    opt.textContent = mat;
    briquetteSelect.appendChild(opt);
  });
}

  function refreshAll() {
  const loc = locationSelect.value;
  updateMaterialDropdowns(loc); // ✅ New: dynamically update dropdowns
  renderTable(loc);
  renderBriquetteTable(loc);

  // ✅ Auto-select first material in each dropdown after update
  const defaultPellet = materialSelect.options[0]?.value;
  const defaultBriquette = briquetteSelect.options[0]?.value;

  if (defaultPellet) updateChart(loc, defaultPellet, chart, true);
  if (defaultBriquette) updateChart(loc, defaultBriquette, briquetteChart, false);
}

  locationSelect.addEventListener("change", refreshAll);
  materialSelect.addEventListener("change", () => updateChart(locationSelect.value, materialSelect.value, chart, true));
  briquetteSelect.addEventListener("change", () => updateChart(locationSelect.value, briquetteSelect.value, briquetteChart, false));

  locationSelect.value = locations[0];
  materialSelect.value = [...pelletLabels][0];
  briquetteSelect.value = [...briquetteLabels][0];

  refreshAll();
});
// ==============================
// FREIGHT CALCULATOR (standalone)
// ==============================
(function () {
  const byId = (id) => document.getElementById(id);
  const fmt = (n) => (isNaN(n) || n == null ? "--" : Number(n).toLocaleString("en-IN"));

  const calcBtn  = byId("fc_calc");
  const resetBtn = byId("fc_reset");
  if (!calcBtn || !resetBtn) return; // calculator not placed on this page

  calcBtn.addEventListener("click", () => {
    const km        = Number(byId("fc_km").value);
    const tons      = Number(byId("fc_tons").value);
    const ratePerKm = Number(byId("fc_ratepkm").value || 0);
    const truckCap  = Number(byId("fc_truck").value || 20);
    const exFactory = Number(byId("fc_exfactory").value || 0);

    if (!km || !tons || !ratePerKm) {
      byId("fc_result").innerHTML = `<div class="error">Please fill Distance, Quantity and Base ₹/km.</div>`;
      return;
    }

    const tripsNeeded   = Math.max(1, Math.ceil(tons / truckCap));
    const freightTotal  = ratePerKm * km * tripsNeeded;
    const perTonFreight = freightTotal / tons;
    const landedPerTon  = exFactory ? (exFactory + perTonFreight) : null;

    byId("fc_result").innerHTML = `
      <div class="result-grid">
        <div><div class="k">Trips Needed</div><div class="v">${tripsNeeded}</div></div>
        <div><div class="k">Total Freight</div><div class="v">₹${fmt(freightTotal)}</div></div>
        <div><div class="k">Freight / ton</div><div class="v">₹${fmt(perTonFreight)}</div></div>
        <div><div class="k">Landed / ton</div><div class="v">${landedPerTon ? "₹" + fmt(landedPerTon) : "<span class='muted'>Enter Ex-Factory to compute</span>"}</div></div>
      </div>
    `;
  });

  resetBtn.addEventListener("click", () => {
    ["fc_source","fc_destination","fc_km","fc_tons","fc_ratepkm","fc_exfactory"].forEach(id => { const el = byId(id); if (el) el.value = ""; });
    const t = byId("fc_truck"); if (t) t.value = "20";
    const r = byId("fc_result"); if (r) r.innerHTML = "";
  });
})();
// =======================================
// SUBMIT YOUR OWN PRICE (local only)
// =======================================
(function () {
  const $ = (id) => document.getElementById(id);
  if (!$("#submitPrice")) return; // block not on page

  // Try to hydrate states from your existing #locationSelect
  (function hydrateStates() {
    const dst = $("#sp_state");
    if (!dst) return;
    const src = document.getElementById("locationSelect");
    if (src && src.options && src.options.length) {
      dst.innerHTML = Array.from(src.options).map(o => `<option>${o.value || o.text}</option>`).join("");
    } else {
      // Fallback minimal list so UI isn't empty
      dst.innerHTML = ["AVERAGE","NCR","Punjab","Haryana","Rajasthan"].map(s => `<option>${s}</option>`).join("");
    }
  })();

  const fmt = (n) => (isNaN(n) || n == null ? "--" : Number(n).toLocaleString("en-IN"));
  function renderFeed() {
    const feed = $("#sp_feed");
    if (!feed) return;
    const items = JSON.parse(localStorage.getItem("peltra_submissions") || "[]");
    if (!items.length) { feed.innerHTML = `<div class="muted">No community submissions yet.</div>`; return; }
    feed.innerHTML = items.slice(0, 10).map(x => {
      const dt = new Date(x.ts).toLocaleString("en-IN");
      return `
        <div class="feed-item">
          <div class="feed-top"><strong>${x.material}</strong> • ₹${fmt(x.price)}/ton</div>
          <div class="feed-mid">${x.city ? x.city + ", " : ""}${x.state}${x.qty ? ` • Qty: ${x.qty}t` : ""}</div>
          ${x.notes ? `<div class="feed-notes">${x.notes}</div>` : ""}
          <div class="feed-time">${dt}</div>
        </div>
      `;
    }).join("");
  }

  $("#sp_submit").addEventListener("click", () => {
    const payload = {
      ts: Date.now(),
      state: $("#sp_state").value || "",
      material: $("#sp_material").value || "",
      price: Number($("#sp_price").value || 0),
      qty: Number($("#sp_qty").value || 0),
      city: $("#sp_city").value || "",
      notes: $("#sp_notes").value || ""
    };
    if (!payload.state || !payload.material || !payload.price) {
      alert("Please fill State, Material and Price.");
      return;
    }
    const existing = JSON.parse(localStorage.getItem("peltra_submissions") || "[]");
    existing.unshift(payload);
    localStorage.setItem("peltra_submissions", JSON.stringify(existing.slice(0, 20)));
    renderFeed();
    ["sp_price","sp_qty","sp_city","sp_notes"].forEach(id => { const el = $("#"+id); if (el) el.value = ""; });
  });

  renderFeed();
})();