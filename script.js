// Market.js – stable sizing + cleaner sparks
// Fetch live JSON from Google Sheets (via Sheet.best)
let sheetData = [];

const SHEET_URL = "https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf";

const toInt = (v) => {
  if (v == null) return 0;
  const n = parseInt(String(v).replace(/,/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

const fmtINR = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : "--");

const loadData = async () => {
  const res = await fetch(SHEET_URL);
  sheetData = await res.json();

  const structured = {};
  const pelletLabels = new Set();
  const briquetteLabels = new Set();

  for (const row of sheetData) {
    const state = row.State?.trim();
    const material = row.Material?.trim();
    const type = row.Type?.trim();

    if (!state || !material || !type) continue;

    const price = toInt(row.Week);
    const trend = [toInt(row.Year), toInt(row["6 Month"]), toInt(row.Month), toInt(row.Week)];

    if (!structured[state]) {
      structured[state] = { materials: { pellets: {}, briquettes: {} } };
    }

    const packet = { price, trend };

    if (type.toLowerCase().includes("pellet")) {
      structured[state].materials.pellets[material] = packet;
      pelletLabels.add(material);
    } else {
      structured[state].materials.briquettes[material] = packet;
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

  const priceCanvas = document.getElementById("priceChart");
  const briqCanvas = document.getElementById("briquetteChart");

  const { structured: dataset, pelletLabels, briquetteLabels } = await loadData();
  pelletLabels.delete("GLOBAL");
  briquetteLabels.delete("GLOBAL");

  const locations = Object.keys(dataset).filter((loc) => loc && loc.toUpperCase() !== "GLOBAL");

  // Populate location
  locations.forEach((loc) => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = loc;
    locationSelect.appendChild(opt);
  });

  // Chart helpers
  let pelletChart = null;
  let briquetteChart = null;

  const chartBaseOptions = {
    responsive: true,
    maintainAspectRatio: false,          // we’ll control height via CSS/container
    aspectRatio: 2,                      // fallback if height not set
    resizeDelay: 150,
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
        ticks: { callback: (v) => `₹${v.toLocaleString("en-IN")}` },
        grace: "5%"
      }
    }
  };

  const makeChart = (canvas, label, data) => {
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Year", "6 Months", "Month", "Week"],
        datasets: [
          {
            label,
            data,
            borderColor: "#1C3D5A",
            backgroundColor: "rgba(29, 66, 90, 0.08)",
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: chartBaseOptions
    });
  };

  const updateChart = (chart, canvas, label, trend) => {
    if (!canvas) return null;
    if (!chart) return makeChart(canvas, label, trend);
    chart.data.datasets[0].label = label;
    chart.data.datasets[0].data = trend;
    chart.update();
    return chart;
  };

  // Normalized sparkline bar heights (always between 12–32px)
  const sparkHTML = (arr, cls = "") => {
    if (!arr?.length) return "";
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = Math.max(1, max - min);
    return arr
      .map((v) => {
        const norm = (v - min) / range;             // 0..1
        const h = Math.round(12 + norm * 20);       // 12–32px
        return `<span class="spark ${cls}" style="height:${h}px"></span>`;
      })
      .join("");
  };

  const renderPelletTable = (loc) => {
    const data = dataset[loc]?.materials?.pellets || {};
    const rows = Object.entries(data)
      .map(([type, { price, trend }]) => {
        return `<tr>
          <td>${type}</td>
          <td><strong>₹${fmtINR(price)}</strong></td>
          <td class="sparkline">${sparkHTML(trend)}</td>
        </tr>`;
      })
      .join("");
    materialTable.innerHTML =
      `<thead><tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr></thead>
       <tbody>${rows || `<tr><td colspan="3">No data</td></tr>`}</tbody>`;
  };

  const renderBriquetteTable = (loc) => {
    const data = dataset[loc]?.materials?.briquettes || {};
    const rows = Object.entries(data)
      .map(([type, { price, trend }]) => {
        return `<tr>
          <td>${type}</td>
          <td><strong>₹${fmtINR(price)}</strong></td>
          <td class="sparkline">${sparkHTML(trend, "briq")}</td>
        </tr>`;
      })
      .join("");
    briquetteTable.innerHTML =
      `<thead><tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr></thead>
       <tbody>${rows || `<tr><td colspan="3">No data</td></tr>`}</tbody>`;
  };

  const refreshMaterialDropdowns = (loc) => {
    materialSelect.innerHTML = "";
    briquetteSelect.innerHTML = "";

    const pellets = Object.keys(dataset[loc]?.materials?.pellets || {});
    const briqs = Object.keys(dataset[loc]?.materials?.briquettes || {});

    pellets.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = m;
      materialSelect.appendChild(opt);
    });
    briqs.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = m;
      briquetteSelect.appendChild(opt);
    });

    if (pellets.length) materialSelect.value = pellets[0];
    if (briqs.length) briquetteSelect.value = briqs[0];
  };

  const updateChartsFor = (loc) => {
    const mat = materialSelect.value;
    const briq = briquetteSelect.value;

    const pTrend = dataset[loc]?.materials?.pellets?.[mat]?.trend || [];
    const bTrend = dataset[loc]?.materials?.briquettes?.[briq]?.trend || [];

    pelletChart = updateChart(pelletChart, priceCanvas, mat || "Pellet", pTrend);
    briquetteChart = updateChart(briquetteChart, briqCanvas, briq || "Briquette", bTrend);

    // timestamps
    const lastRow = sheetData.find((r) => r["Last Updated"]);
    if (lastRow) {
      const s1 = document.getElementById("pelletTimestamp");
      const s2 = document.getElementById("briquetteTimestamp");
      if (s1) s1.textContent = lastRow["Last Updated"];
      if (s2) s2.textContent = lastRow["Last Updated"];
    }
  };

  const refreshAll = () => {
    const loc = locationSelect.value;
    if (!loc) return;
    refreshMaterialDropdowns(loc);
    renderPelletTable(loc);
    renderBriquetteTable(loc);
    updateChartsFor(loc);
  };

  // Init defaults
  locationSelect.value = locations[0] || "";

  // Listeners
  locationSelect.addEventListener("change", refreshAll);
  materialSelect.addEventListener("change", () => updateChartsFor(locationSelect.value));
  briquetteSelect.addEventListener("change", () => updateChartsFor(locationSelect.value));

  // First render
  refreshAll();
});