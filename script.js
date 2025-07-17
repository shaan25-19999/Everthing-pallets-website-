const loadData = async () => {
  const res = await fetch("market-data.json");
  return await res.json();
};

document.addEventListener("DOMContentLoaded", async () => {
  const locationSelect = document.getElementById("locationSelect");
  const materialSelect = document.getElementById("materialSelect");
  const briquetteSelect = document.getElementById("briquetteSelect");
  const materialTable = document.getElementById("materialTable");
  const briquetteTable = document.getElementById("briquetteTable");
  const chartTitle = document.getElementById("chartTitle");
  const briquetteChartTitle = document.getElementById("briquetteChartTitle");
  const ctx = document.getElementById("priceChart").getContext("2d");
  const briquetteCtx = document.getElementById("briquetteChart").getContext("2d");

  const dataset = await loadData();
  const locations = dataset.locations;
  const materialLabels = dataset.material_labels;
  const briquetteLabels = dataset.briquette_labels;

  // Populate location dropdown
  for (const loc in locations) {
  const option = document.createElement("option");
  option.value = loc;
  option.text = locations[loc].name;
  locationSelect.appendChild(option);
}

  // Populate material dropdown
  for (const mat in materialLabels) {
    const option = document.createElement("option");
    option.value = mat;
    option.text = materialLabels[mat];
    materialSelect.appendChild(option);
  }
  // Populate briquette dropdown
  for (const briq in briquetteLabels) {
    const option = document.createElement("option");
    option.value = briq;
    option.text = briquetteLabels[briq];
    briquetteSelect.appendChild(option);
  }
    // Create main Pellet Chart
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Year', '6 Months', 'Month', 'Week'],
      datasets: [{
        label: '',
        data: [],
        borderColor: '#40916c',
        backgroundColor: 'rgba(64,145,108,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => `₹${context.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (val) => `₹${val.toLocaleString()}`
          }
        }
      }
    }
  });

  // Create Briquette Chart
  const briquetteChart = new Chart(briquetteCtx, {
    type: 'line',
    data: {
      labels: ['Year', '6 Months', 'Month', 'Week'],
      datasets: [{
        label: '',
        data: [],
        borderColor: '#6a4f2d',
        backgroundColor: 'rgba(106,79,45,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => `₹${context.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (val) => `₹${val.toLocaleString()}`
          }
        }
      }
    }
  });
    function renderTable(locationKey) {
    const materials = locations[locationKey].materials;
    materialTable.innerHTML = `
      <tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>
      ${Object.entries(materials).filter(([k]) => k !== 'briquettes').map(([mat, obj]) => {
        const price = obj.price.toLocaleString();
        const spark = obj.trend.slice().reverse().join(',');
        return `<tr>
          <td>${materialLabels[mat]}</td>
          <td><strong>₹${price}</strong></td>
          <td><span class="sparkline" data-values="${spark}"></span></td>
        </tr>`;
      }).join("")}
    `;
    renderSparklines();
  }

  function renderBriquetteTable(locationKey) {
    const briquettes = locations[locationKey].materials.briquettes;
    const briquetteTable = document.getElementById("briquetteTable");
    briquetteTable.innerHTML = `
      <tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>
      ${Object.entries(briquettes).map(([type, obj]) => {
        const price = obj.price.toLocaleString();
        const spark = obj.trend.slice().reverse().join(',');
        return `<tr>
          <td>${briquetteLabels[type]}</td>
          <td><strong>₹${price}</strong></td>
          <td><span class="sparkline" data-values="${spark}"></span></td>
        </tr>`;
      }).join("")}
    `;
    renderSparklines();
  }

  function renderSparklines() {
    document.querySelectorAll('.sparkline').forEach(el => {
      const values = el.dataset.values.split(',').map(Number);
      const max = Math.max(...values), min = Math.min(...values);
      el.innerHTML = values.map(val => {
        const height = 20 + (val - min) / (max - min + 1) * 30;
        return `<span style="display:inline-block;width:5px;height:${height}px;background:#52b788;margin-right:2px;"></span>`;
      }).join('');
    });
  }
    function updateGraph(locationKey, materialKey) {
    const trend = locations[locationKey].materials[materialKey].trend;
    chart.data.datasets[0].label = `${materialLabels[materialKey]}`;
    chart.data.datasets[0].data = trend;
    chartTitle.textContent = `Price trend of ${materialLabels[materialKey]} in ${locations[locationKey].name}`;
    chart.update();
  }

  function updateBriquetteGraph(locationKey, briquetteKey) {
    const trend = locations[locationKey].materials.briquettes[briquetteKey].trend;
    briquetteChart.data.datasets[0].label = `${briquetteLabels[briquetteKey]}`;
    briquetteChart.data.datasets[0].data = trend;
    document.getElementById("briquetteChartTitle").textContent = 
      `Price trend of ${briquetteLabels[briquetteKey]} in ${locations[locationKey].name}`;
    briquetteChart.update();
  }

  // Smooth UI loading
  function fadeIn(el) {
    el.style.opacity = 0;
    el.style.display = 'block';
    setTimeout(() => el.style.transition = "opacity 0.6s", 50);
    setTimeout(() => el.style.opacity = 1, 100);
  }

  function refreshAll(locationKey) {
    renderTable(locationKey);
    renderBriquetteTable(locationKey);
    updateGraph(locationKey, materialSelect.value);
    updateBriquetteGraph(locationKey, briquetteSelect.value);
  }

  locationSelect.addEventListener("change", () => {
    const loc = locationSelect.value;
    refreshAll(loc);
  });

  materialSelect.addEventListener("change", () => {
    updateGraph(locationSelect.value, materialSelect.value);
  });

  briquetteSelect.addEventListener("change", () => {
    updateBriquetteGraph(locationSelect.value, briquetteSelect.value);
  });
    // Set defaults
  locationSelect.value = Object.keys(locations)[0];
  materialSelect.value = Object.keys(materialLabels)[0];
  briquetteSelect.value = Object.keys(briquetteLabels)[0];

  // Initial render
  refreshAll(locationSelect.value);

  // Fade in content for smoother experience
  document.querySelectorAll('main section').forEach(fadeIn);
});