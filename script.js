/* =========================================================
   Market Prices – EverythingPallets
   Features:
   - Load + structure data from Sheet.best
   - Location/material dropdowns, tables, charts
   - Freight Calculator
   - Fuel Comparison (our materials only)
   - Submit Price + WhatsApp CTA
   ========================================================= */

(() => {
  // ---------- Config ----------
  const SHEET_URL = "https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf";
  const WHATSAPP_NUMBER = "919999999999"; // change when you have a live number

  // ---------- State ----------
  let rawRows = [];
  let dataset = {}; // { [location]: { materials: { pellets: { mat: {price,trend,kcal?} }, briquettes: {...}} } }
  let pelletLabels = new Set();
  let briquetteLabels = new Set();
  let locations = [];

  let pelletChartInstance = null;
  let briquetteChartInstance = null;

  // ---------- Utils ----------
  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));
  const ce = (t) => document.createElement(t);

  const toInt = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/,/g, "").trim();
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  };

  const fmtINR = (n) => (typeof n === "number" ? n.toLocaleString("en-IN") : "--");

  // For ₹ per MMkcal: price(₹/ton) * 1000 / kcal_per_kg
  const costPerMMkcal = (pricePerTon, kcalPerKg) => {
    const p = Number(pricePerTon);
    const k = Number(kcalPerKg);
    if (!p || !k) return null;
    return (p * 1000) / k;
  };

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // ---------- Data Load & Structure ----------
  async function loadData() {
    const res = await fetch(SHEET_URL);
    rawRows = await res.json();

    const structured = {};
    pelletLabels = new Set();
    briquetteLabels = new Set();

    for (const row of rawRows) {
      const state = row.State?.trim();
      const mat = row.Material?.trim();
      const type = row.Type?.trim();
      if (!state || !mat || !type) continue;

      // week price used as display price
      const price = toInt(row.Week);
      const trend = [toInt(row.Year), toInt(row["6 Month"]), toInt(row.Month), toInt(row.Week)];

      // optional specs (from GLOBAL rows or where available)
      const kcal = toInt(row.Kcal);
      const ash = row.Ash?.toString()?.trim();
      const moisture = row.Moisture?.toString()?.trim();

      if (!structured[state]) {
        structured[state] = { materials: { pellets: {}, briquettes: {} } };
      }

      const packet = { price, trend };
      if (kcal) packet.kcal = kcal;
      if (ash) packet.ash = ash;
      if (moisture) packet.moisture = moisture;

      if (type.toLowerCase().includes("pellet")) {
        structured[state].materials.pellets[mat] = packet;
        pelletLabels.add(mat);
      } else {
        structured[state].materials.briquettes[mat] = packet;
        briquetteLabels.add(mat);
      }
    }

    // List of locations excluding GLOBAL
    locations = Object.keys(structured).filter((loc) => loc.toUpperCase() !== "GLOBAL");
    dataset = structured;

    // Last updated (any row with that field)
    const lastRow = rawRows.find((r) => r["Last Updated"]);
    if (lastRow) setText("marketLastUpdated", `Last updated: ${lastRow["Last Updated"]}`);
  }

  // ---------- Populate UI ----------
  function populateDropdowns() {
    const locSel = document.getElementById("locationSelect");
    const pelletSel = document.getElementById("materialSelect");
    const briqSel = document.getElementById("briquetteSelect");
    if (!locSel || !pelletSel || !briqSel) return;

    // Locations
    locSel.innerHTML = "";
    locations.forEach((loc) => {
      const opt = ce("option");
      opt.value = opt.textContent = loc;
      locSel.appendChild(opt);
    });

    // Default location
    if (locations.length) locSel.value = locations[0];

    // Materials will be set based on location
    refreshMaterialDropdowns(locSel.value);
  }

  function refreshMaterialDropdowns(locationKey) {
    const pelletSel = document.getElementById("materialSelect");
    const briqSel = document.getElementById("briquetteSelect");
    if (!pelletSel || !briqSel) return;

    pelletSel.innerHTML = "";
    briqSel.innerHTML = "";

    const pellets = Object.keys(dataset[locationKey]?.materials?.pellets || {});
    const briqs = Object.keys(dataset[locationKey]?.materials?.briquettes || {});

    pellets.forEach((m) => {
      const opt = ce("option");
      opt.value = opt.textContent = m;
      pelletSel.appendChild(opt);
    });
    briqs.forEach((m) => {
      const opt = ce("option");
      opt.value = opt.textContent = m;
      briqSel.appendChild(opt);
    });

    if (pellets.length) pelletSel.value = pellets[0];
    if (briqs.length) briqSel.value = briqs[0];
  }

  function renderTables(locationKey) {
    // Pellets
    const matTable = document.getElementById("materialTable");
    if (matTable) {
      const data = dataset[locationKey]?.materials?.pellets || {};
      const rowsHTML = Object.entries(data)
        .map(([type, { price, trend }]) => {
          const spark = trend
            .map((v) => `<span class="spark" style="height:${8 + v / 120}px"></span>`)
            .join("");
          return `<tr>
              <td>${type}</td>
              <td><strong>₹${fmtINR(price)}</strong></td>
              <td class="sparkline">${spark}</td>
            </tr>`;
        })
        .join("");
      matTable.innerHTML = `
        <thead><tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr></thead>
        <tbody>${rowsHTML || `<tr><td colspan="3">No data</td></tr>`}</tbody>`;
    }

    // Briquettes
    const briqTable = document.getElementById("briquetteTable");
    if (briqTable) {
      const data = dataset[locationKey]?.materials?.briquettes || {};
      const rowsHTML = Object.entries(data)
        .map(([type, { price, trend }]) => {
          const spark = trend
            .map((v) => `<span class="spark briq" style="height:${8 + v / 120}px"></span>`)
            .join("");
          return `<tr>
              <td>${type}</td>
              <td><strong>₹${fmtINR(price)}</strong></td>
              <td class="sparkline">${spark}</td>
            </tr>`;
        })
        .join("");
      briqTable.innerHTML = `
        <thead><tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr></thead>
        <tbody>${rowsHTML || `<tr><td colspan="3">No data</td></tr>`}</tbody>`;
    }
  }

  // ---------- Charts ----------
  function createOrUpdateChart(canvasId, label, dataPoints, colorLine, colorFill, existingInstance) {
    const el = document.getElementById(canvasId);
    if (!el) return null;

    const config = {
      type: "line",
      data: {
        labels: ["Year", "6 Months", "Month", "Week"],
        datasets: [
          {
            label,
            data: dataPoints,
            borderColor: colorLine,
            backgroundColor: colorFill,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            ticks: {
              callback: (v) => `₹${v.toLocaleString("en-IN")}`
            }
          }
        }
      }
    };

    if (existingInstance) {
      existingInstance.data = config.data;
      existingInstance.update();
      return existingInstance;
    }
    return new Chart(el.getContext("2d"), config);
  }

  function updateCharts(locationKey) {
    // Pellet chart
    const pelletSel = document.getElementById("materialSelect");
    const mat = pelletSel?.value;
    const p = dataset[locationKey]?.materials?.pellets?.[mat];
    const trendP = p?.trend || [];
    pelletChartInstance = createOrUpdateChart(
      "priceChart",
      mat || "Pellet",
      trendP,
      "#1C3D5A",
      "#DDEAF4",
      pelletChartInstance
    );

    // Briquette chart
    const briqSel = document.getElementById("briquetteSelect");
    const bm = briqSel?.value;
    const b = dataset[locationKey]?.materials?.briquettes?.[bm];
    const trendB = b?.trend || [];
    briquetteChartInstance = createOrUpdateChart(
      "briquetteChart",
      bm || "Briquette",
      trendB,
      "#FFA500",
      "#FFEFD5",
      briquetteChartInstance
    );

    // timestamps (from any "Last Updated")
    const lastRow = rawRows.find((r) => r["Last Updated"]);
    if (lastRow) {
      setText("pelletTimestamp", lastRow["Last Updated"]);
      setText("briquetteTimestamp", lastRow["Last Updated"]);
    }
  }

  // ---------- New Feature 1: Freight Calculator ----------
  function bindFreightCalculator() {
    const form = document.getElementById("freightForm");
    const clearBtn = document.getElementById("clearFreight");
    if (!form) return;

    const tripsEl = document.getElementById("rTrips");
    const totalEl = document.getElementById("rTotalFreight");
    const perTonEl = document.getElementById("rFreightPerTon");
    const landedEl = document.getElementById("rLandedPerTon");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);

      const distanceKm = Number(fd.get("distanceKm"));
      const qtyTons = Number(fd.get("quantityTons"));
      const truckCap = Number(fd.get("truckCapacity"));
      const ratePerKm = Number(fd.get("ratePerKm")) || 0;
      const matPrice = Number(fd.get("baseMaterialPrice")) || 0;

      if (!distanceKm || !qtyTons || !truckCap) return;

      const trips = Math.ceil(qtyTons / truckCap);
      const totalFreight = Math.round(distanceKm * ratePerKm * trips);
      const freightPerTon = Math.round(totalFreight / qtyTons);
      const landedPerTon = matPrice ? Math.round(matPrice + freightPerTon) : null;

      if (tripsEl) tripsEl.textContent = String(trips);
      if (totalEl) totalEl.textContent = `₹${fmtINR(totalFreight)}`;
      if (perTonEl) perTonEl.textContent = `₹${fmtINR(freightPerTon)}`;
      if (landedEl) landedEl.textContent = landedPerTon ? `₹${fmtINR(landedPerTon)}` : "—";
    });

    clearBtn?.addEventListener("click", () => {
      form.reset();
      ["rTrips", "rTotalFreight", "rFreightPerTon", "rLandedPerTon"].forEach((id) => setText(id, "—"));
    });
  }

  // ---------- New Feature 2: Fuel Comparison (our materials only) ----------
  // We’ll take the current selected location’s pellet & briquette materials.
  // If kcal is not present for a material, we’ll leave row but mark cost as "—".
  function buildFuelCompare(locationKey) {
    const body = document.getElementById("fuelCompareBody");
    if (!body) return;

    const pellets = dataset[locationKey]?.materials?.pellets || {};
    const briqs = dataset[locationKey]?.materials?.briquettes || {};

    const rows = [];

    const pushRow = (fuelName, packet, type) => {
      const kcal = packet.kcal || null;
      const price = packet.price || null;
      const perMM = kcal && price ? costPerMMkcal(price, kcal) : null;

      rows.push({
        fuel: fuelName,
        kcal: kcal || "",
        price: price || "",
        perMMkcal: perMM,
        type
      });
    };

    Object.entries(pellets).forEach(([name, pkt]) => pushRow(name, pkt, "pellet"));
    Object.entries(briqs).forEach(([name, pkt]) => pushRow(name, pkt, "briquette"));

    // Render
    body.innerHTML = rows
      .map((r, i) => {
        const best = r.perMMkcal ? `<span class="chip ${i === 0 ? "primary" : "muted"}">—</span>` : "";
        return `<tr data-type="${r.type}">
          <td>${r.fuel}</td>
          <td><input class="cell kcal" type="number" min="0" value="${r.kcal || ""}" placeholder="kcal/kg" /></td>
          <td><input class="cell price" type="number" min="0" value="${r.price || ""}" placeholder="₹/ton" /></td>
          <td class="cpmk">${r.perMMkcal ? `₹${fmtINR(Math.round(r.perMMkcal))}` : "—"}</td>
          <td class="best">—</td>
        </tr>`;
      })
      .join("");

    // Compute “best” (lowest ₹/MMkcal) initially
    recalcFuelCompare();
  }

  function recalcFuelCompare() {
    const body = document.getElementById("fuelCompareBody");
    if (!body) return;

    const rows = Array.from(body.querySelectorAll("tr"));
    const computed = rows.map((tr) => {
      const kcal = Number(tr.querySelector(".kcal")?.value || 0);
      const price = Number(tr.querySelector(".price")?.value || 0);
      const per = kcal && price ? costPerMMkcal(price, kcal) : null;
      tr.querySelector(".cpmk").textContent = per ? `₹${fmtINR(Math.round(per))}` : "—";
      return per;
    });

    // Find min valid
    let minVal = Infinity;
    let minIdx = -1;
    computed.forEach((val, i) => {
      if (val && val < minVal) {
        minVal = val;
        minIdx = i;
      }
    });

    rows.forEach((tr, i) => {
      const bestCell = tr.querySelector(".best");
      if (!bestCell) return;
      if (i === minIdx) {
        bestCell.textContent = "✅ Best";
        bestCell.classList.add("good");
      } else {
        bestCell.textContent = "—";
        bestCell.classList.remove("good");
      }
    });
  }

  function bindFuelCompareActions() {
    const body = document.getElementById("fuelCompareBody");
    const recalcBtn = document.getElementById("recalcFuel");
    const resetBtn = document.getElementById("resetFuel");
    if (!body) return;

    body.addEventListener("input", (e) => {
      if (e.target.classList.contains("kcal") || e.target.classList.contains("price")) {
        recalcFuelCompare();
      }
    });

    recalcBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      recalcFuelCompare();
    });

    resetBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      // Clear user edits and rebuild table from current location
      const loc = document.getElementById("locationSelect")?.value;
      buildFuelCompare(loc);
    });
  }

  // ---------- New Feature 3: Submit Price + Call/WhatsApp ----------
  function bindSubmitPrice() {
    const form = document.getElementById("submitPriceForm");
    const statusEl = document.getElementById("spStatus");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const mat = fd.get("spMaterial") || qs("#spMaterial")?.value;
      const loc = fd.get("spLocation") || qs("#spLocation")?.value;
      const price = fd.get("spPrice") || qs("#spPrice")?.value;
      const qty = fd.get("spQty") || qs("#spQty")?.value;

      if (!mat || !loc || !price) {
        if (statusEl) statusEl.textContent = "Please fill Material, Location and Price.";
        return;
      }

      // For now: send to WhatsApp as a prefilled message (no backend needed)
      const msg =
        `Peltra – Price Submission:\n` +
        `Material: ${mat}\n` +
        `Location: ${loc}\n` +
        `Price: ₹${price}/ton\n` +
        (qty ? `Quantity: ${qty} tons\n` : "") +
        `Submitted from Market Prices page.`;

      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank", "noopener");

      if (statusEl) statusEl.textContent = "Thanks! Opening WhatsApp…";
      form.reset();
      setTimeout(() => statusEl && (statusEl.textContent = ""), 3000);
    });

    // Pre-fill WhatsApp CTA on the “Call for Best Rates” card
    const waBtn = document.getElementById("waBestRates");
    if (waBtn) {
      const base =
        "Hi Peltra team, I need the best rate and top-quality biofuel.\n" +
        "Details:\n- Material: [your material]\n- Location: [your city/state]\n- Quantity: [tons]\n" +
        "Please share delivered price.";
      waBtn.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(base)}`;
    }
  }

  // ---------- Page Wiring ----------
  function refreshAll() {
    const locSel = document.getElementById("locationSelect");
    if (!locSel || !locSel.value) return;
    const loc = locSel.value;

    // Update dependent dropdowns
    refreshMaterialDropdowns(loc);

    // Tables
    renderTables(loc);

    // Charts
    updateCharts(loc);

    // Fuel comparison table
    buildFuelCompare(loc);
  }

  function bindCoreHandlers() {
    const locSel = document.getElementById("locationSelect");
    const pelletSel = document.getElementById("materialSelect");
    const briqSel = document.getElementById("briquetteSelect");

    locSel?.addEventListener("change", refreshAll);
    pelletSel?.addEventListener("change", () => updateCharts(locSel.value));
    briqSel?.addEventListener("change", () => updateCharts(locSel.value));
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await loadData();
      populateDropdowns();
      bindCoreHandlers();

      // New features
      bindFreightCalculator();
      buildFuelCompare(document.getElementById("locationSelect")?.value);
      bindFuelCompareActions();
      bindSubmitPrice();

      // First render
      refreshAll();
    } catch (err) {
      console.error("Failed to initialize market page:", err);
    }
  });
})();