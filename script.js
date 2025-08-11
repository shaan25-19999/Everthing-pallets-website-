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