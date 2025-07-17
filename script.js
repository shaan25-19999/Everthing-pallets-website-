
const loadData = async () => {
  const res = await fetch("market-data.json");
  return await res.json();
};

document.addEventListener("DOMContentLoaded", async () => {
  const locationSelect = document.getElementById("locationSelect");
  const materialSelect = document.getElementById("materialSelect");
  const materialTable = document.getElementById("materialTable");
  const chartTitle = document.getElementById("chartTitle");
  const ctx = document.getElementById("priceChart").getContext("2d");

  const dataset = await loadData();
  const locations = dataset.locations;
  const materialLabels = dataset.material_labels;

  for (const loc in locations) {
    const option = document.createElement("option");
    option.value = loc;
    option.text = locations[loc].name;
    locationSelect.appendChild(option);
  }

  for (const mat in materialLabels) {
    const option = document.createElement("option");
    option.value = mat;
    option.text = materialLabels[mat];
    materialSelect.appendChild(option);
  }

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['YEAR', '6 MONTHS', 'MONTH', 'WEEK'],
      datasets: [{
        label: '',
        data: [],
        borderColor: '#40916c',
        fill: false
      }]
    },
    options: { responsive: true }
  });

  function renderTable(locationKey) {
    const materials = locations[locationKey].materials;
    materialTable.innerHTML = `
      <tr><th>Pellet Type</th><th>Price (₹/ton)</th></tr>
      ${Object.entries(materials).map(([mat, obj]) =>
        `<tr><td>${materialLabels[mat]}</td><td>${obj.price}</td></tr>`
      ).join("")}
    `;
  }

  function updateGraph(locationKey, materialKey) {
    const trend = locations[locationKey].materials[materialKey].trend;
    chart.data.datasets[0].label = `${materialLabels[materialKey]}`;
    chart.data.datasets[0].data = trend;
    chartTitle.textContent = `Price trend of ${materialLabels[materialKey]} in ${locations[locationKey].name}`;
    chart.update();
  }

  locationSelect.addEventListener("change", () => {
    renderTable(locationSelect.value);
    updateGraph(locationSelect.value, materialSelect.value);
  });

  materialSelect.addEventListener("change", () => {
    updateGraph(locationSelect.value, materialSelect.value);
  });

  locationSelect.value = Object.keys(locations)[0];
  materialSelect.value = Object.keys(materialLabels)[0];
  renderTable(locationSelect.value);
  updateGraph(locationSelect.value, materialSelect.value);
});
