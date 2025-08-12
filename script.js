// ===== Config =====
const API_URL = "https://api.sheetbest.com/sheets/5ac0ae3c-c8d3-4f90-a9af-18198287e688";

// ===== State =====
let sheetData = [];
let priceChartInstance = null;
let briquetteChartInstance = null;

// ===== Helpers =====
const fmt = (n) => (isNaN(n) || n === null || n === undefined ? "--" : Number(n).toLocaleString("en-IN"));
const el = (id) => document.getElementById(id);

// ===== Boot =====
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  hydrateUI();
  bindFreightCalc();
  bindSubmitPrice();
});

// ===== Load data =====
async function loadData() {
  try {
    const res = await fetch(API_URL);
    sheetData = await res.json();
  } catch (e) {
    console.error("Failed fetching data:", e);
    sheetData = [];
  }
}

// ===== UI + Tables + Charts =====
function hydrateUI() {
  const states = [...new Set(sheetData.map(r => (r.State || "").trim()).filter(Boolean))].sort();
  // populate location select
  const loc = el("locationSelect");
  loc.innerHTML = states.map(s => `<option value="${s}">${s}</option>`).join("");
  // default location
  const hasAverage = states.find(s => s.toUpperCase() === "AVERAGE");
  loc.value = hasAverage ? "AVERAGE" : states[0];
  loc.addEventListener("change", () => {
    renderTables(loc.value);
    renderCharts(loc.value);
  });

  // populate material dropdowns
  const pelletTypes = [...new Set(sheetData.filter(r => (r.Type||"").toLowerCase()==="pellet").map(r => r.Material).filter(Boolean))];
  const briqTypes   = [...new Set(sheetData.filter(r => (r.Type||"").toLowerCase()==="briquette").map(r => r.Material).filter(Boolean))];

  el("materialSelect").innerHTML  = pelletTypes.map(m => `<option>${m}</option>`).join("");
  el("briquetteSelect").innerHTML = briqTypes.map(m => `<option>${m}</option>`).join("");

  // submit price state list
  el("sp_state").innerHTML = states.map(s => `<option>${s}</option>`).join("");

  // initial render
  renderTables(loc.value);
  renderCharts(loc.value);

  // timestamps
  el("lastUpdated").textContent = "Last updated: " + new Date().toLocaleString("en-IN");
  el("pelletTimestamp").textContent = new Date().toLocaleString("en-IN");
  el("briquetteTimestamp").textContent = new Date().toLocaleString("en-IN");

  // hydrate community feed
  renderCommunityFeed();
}

function renderTables(location) {
  // Build pellet & briquette tables for the location
  const locRows = sheetData.filter(r => (r.State||"").trim() === location);

  const pellets = locRows.filter(r => (r.Type||"").toLowerCase() === "pellet");
  const briqs   = locRows.filter(r => (r.Type||"").toLowerCase() === "briquette");

  const makeTable = (rows) => {
    if (!rows.length) return "<tr><td>No data</td></tr>";
    const header = `
      <tr>
        <th>Material</th>
        <th>Price (₹/ton)</th>
        <th>Ash %</th>
        <th>Moisture %</th>
        <th>Kcal/kg</th>
        <th></th>
      </tr>`;
    const body = rows.map(r => `
      <tr>
        <td>${r.Material || "-"}</td>
        <td>${fmt(r.Price)}</td>
        <td>${r.Ash || "-"}</td>
        <td>${r.Moisture || "-"}</td>
        <td>${r.Kcal || "-"}</td>
        <td><button class="btn tiny buy-btn" data-material="${r.Material||""}" data-price="${r.Price||""}">Book Now</button></td>
      </tr>`).join("");
    return header + body;
  };

  el("materialTable").innerHTML  = makeTable(pellets);
  el("briquetteTable").innerHTML = makeTable(briqs);

  // attach quick "Book Now" (routes to WhatsApp)
  document.querySelectorAll(".buy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const material = btn.dataset.material || "Pellet";
      const price = btn.dataset.price || "";
      const msg = encodeURIComponent(`Hi Peltra, I want to book ${material} at current market rate ${price ? "₹"+price+"/ton" : ""}. Please call back.`);
      window.open(`https://wa.me/919999999999?text=${msg}`, "_blank");
    });
  });
}

function renderCharts(location) {
  const labels = ["Year", "6 Months", "Month", "Week"];

  const firstPellet = sheetData.find(r => (r.State||"").trim() === location && (r.Type||"").toLowerCase()==="pellet");
  const firstBriq   = sheetData.find(r => (r.State||"").trim() === location && (r.Type||"").toLowerCase()==="briquette");

  const parseVals = (row) => ([
    parseInt(row?.Year || 0, 10),
    parseInt(row?.["6 Month"] || row?.["6 Months"] || row?.["6mo"] || 0, 10),
    parseInt(row?.Month || 0, 10),
    parseInt(row?.Week || 0, 10)
  ]);

  const pelletVals = firstPellet ? parseVals(firstPellet) : [0,0,0,0];
  const briqVals   = firstBriq   ? parseVals(firstBriq)   : [0,0,0,0];

  if (priceChartInstance) priceChartInstance.destroy();
  if (briquetteChartInstance) briquetteChartInstance.destroy();

  const ctx1 = document.getElementById("priceChart");
  priceChartInstance = new Chart(ctx1, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Pellet Price",
        data: pelletVals,
        borderColor: "#1C3D5A",
        backgroundColor: "rgba(29, 77, 106, 0.08)",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }},
      scales: {
        y: {
          ticks: { callback: (v) => "₹" + Number(v).toLocaleString("en-IN") }
        }
      }
    }
  });

  const ctx2 = document.getElementById("briquetteChart");
  briquetteChartInstance = new Chart(ctx2, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Briquette Price",
        data: briqVals,
        borderColor: "#FFA500",
        backgroundColor: "rgba(255,165,0,0.12)",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }},
      scales: {
        y: {
          ticks: { callback: (v) => "₹" + Number(v).toLocaleString("en-IN") }
        }
      }
    }
  });

  // Change-by-material dropdowns
  document.getElementById("materialSelect").onchange = (e) => {
    const mat = e.target.value;
    const row = sheetData.find(r => (r.State||"").trim() === location && (r.Type||"").toLowerCase()==="pellet" && r.Material === mat);
    const vals = row ? parseVals(row) : [0,0,0,0];
    priceChartInstance.data.datasets[0].data = vals;
    priceChartInstance.update();
  };

  document.getElementById("briquetteSelect").onchange = (e) => {
    const mat = e.target.value;
    const row = sheetData.find(r => (r.State||"").trim() === location && (r.Type||"").toLowerCase()==="briquette" && r.Material === mat);
    const vals = row ? parseVals(row) : [0,0,0,0];
    briquetteChartInstance.data.datasets[0].data = vals;
    briquetteChartInstance.update();
  };
}

// ===== Freight Calculator =====
function bindFreightCalc() {
  el("fc_calc").addEventListener("click", () => {
    const km = Number(el("fc_km").value);
    const tons = Number(el("fc_tons").value);
    const ratePerKm = Number(el("fc_ratepkm").value || 0);
    const truckCap = Number(el("fc_truck").value || 20);
    const exFactory = Number(el("fc_exfactory").value || 0);

    if (!km || !tons || !ratePerKm) {
      el("fc_result").innerHTML = `<div class="error">Please fill Distance, Quantity and Base ₹/km.</div>`;
      return;
    }

    // Simple model:
    // Freight = ratePerKm * km (+ light utilization adjustment for partial load)
    // Per-ton freight = Freight / tons (if tons > truckCap, assume multi-trips proportionally)
    // Landed per ton = exFactory + perTonFreight (if exFactory given)

    const tripsNeeded = Math.max(1, Math.ceil(tons / truckCap));
    const freightTotal = ratePerKm * km * tripsNeeded;
    const perTonFreight = freightTotal / tons;
    const landedPerTon = exFactory ? (exFactory + perTonFreight) : null;

    el("fc_result").innerHTML = `
      <div class="result-grid">
        <div>
          <div class="k">Trips Needed</div>
          <div class="v">${tripsNeeded}</div>
        </div>
        <div>
          <div class="k">Total Freight</div>
          <div class="v">₹${fmt(freightTotal)}</div>
        </div>
        <div>
          <div class="k">Freight / ton</div>
          <div class="v">₹${fmt(perTonFreight)}</div>
        </div>
        <div>
          <div class="k">Landed / ton</div>
          <div class="v">${landedPerTon ? "₹" + fmt(landedPerTon) : "<span class='muted'>Enter Ex-Factory to compute</span>"}</div>
        </div>
      </div>
    `;
  });

  el("fc_reset").addEventListener("click", () => {
    ["fc_source","fc_destination","fc_km","fc_tons","fc_ratepkm","fc_exfactory"].forEach(id => el(id).value = "");
    el("fc_truck").value = "20";
    el("fc_result").innerHTML = "";
  });
}

// ===== Submit Your Own Price (local only) =====
function bindSubmitPrice() {
  el("sp_submit").addEventListener("click", () => {
    const payload = {
      ts: Date.now(),
      state: el("sp_state").value || "",
      material: el("sp_material").value || "",
      price: Number(el("sp_price").value || 0),
      qty: Number(el("sp_qty").value || 0),
      city: el("sp_city").value || "",
      notes: el("sp_notes").value || ""
    };

    if (!payload.state || !payload.material || !payload.price) {
      alert("Please fill State, Material and Price.");
      return;
    }

    // Save to localStorage
    const existing = JSON.parse(localStorage.getItem("peltra_submissions") || "[]");
    existing.unshift(payload);
    localStorage.setItem("peltra_submissions", JSON.stringify(existing.slice(0, 20)));

    // UI
    renderCommunityFeed();

    // Clear minimal fields
    el("sp_price").value = "";
    el("sp_qty").value = "";
    el("sp_city").value = "";
    el("sp_notes").value = "";
  });
}

function renderCommunityFeed() {
  const feed = el("sp_feed");
  const rows = JSON.parse(localStorage.getItem("peltra_submissions") || "[]");
  if (!rows.length) {
    feed.innerHTML = `<div class="muted">No community submissions yet.</div>`;
    return;
  }
  feed.innerHTML = rows.slice(0, 10).map(x => {
    const dt = new Date(x.ts).toLocaleString("en-IN");
    return `
      <div class="feed-item">
        <div class="feed-top">
          <strong>${x.material}</strong> • ₹${fmt(x.price)}/ton
        </div>
        <div class="feed-mid">
          <span>${x.city ? x.city + ", " : ""}${x.state}</span>
          ${x.qty ? ` • Qty: ${x.qty}t` : ""}
        </div>
        ${x.notes ? `<div class="feed-notes">${x.notes}</div>` : ""}
        <div class="feed-time">${dt}</div>
      </div>
    `;
  }).join("");
}