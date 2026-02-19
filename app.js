const el = (id) => document.getElementById(id);

function getCheckedDows(){
  return Array.from(document.querySelectorAll(".day"))
    .filter(x => x.checked)
    .map(x => parseInt(x.dataset.dow, 10));
}

function countWorkingDaysInMonth(dateObj, workingDows){
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  let count = 0;
  for(let d = 1; d <= daysInMonth; d++){
    const dt = new Date(y, m, d);
    const dow = dt.getDay(); // 0..6
    if(workingDows.includes(dow)) count++;
  }
  return count;
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function roundNearest(value, nearest){
  const n = Number(nearest);
  if(!n) return value;
  return Math.round(value / n) * n;
}

// margin is % of selling price (pre-tax): price = cost / (1 - margin)
function priceFromMargin(preTaxCost, marginPct){
  const m = clamp(marginPct / 100, 0, 0.95);
  return preTaxCost / (1 - m);
}

function fmt(num){
  if(!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);
}

function setPremiumEditing(isPremium){
  const monthlyFixed = el("monthlyFixed");
  const mSafe = el("mSafe");
  const mStd = el("mStd");
  const mPrem = el("mPrem");

  monthlyFixed.disabled = !isPremium;

  mSafe.disabled = !isPremium;
  mStd.disabled = !isPremium;
  mPrem.disabled = !isPremium;

  // keep values but prevent editing when off
}

function syncModeUI(){
  const mode = el("mode").value;
  el("retailHoursRow").style.display = mode === "retail" ? "flex" : "none";
  el("wholesaleUnitsRow").style.display = mode === "wholesale" ? "flex" : "none";
}

function calc(){
  const mode = el("mode").value;
  const isPremium = el("isPremium").checked;

  const productionCost = Number(el("productionCost").value || 0);
  const extraExpenses = Number(el("extraExpenses").value || 0);

  const monthlyFixed = isPremium ? Number(el("monthlyFixed").value || 0) : 0;
  const hoursPerDay = Number(el("hoursPerDay").value || 0);

  const quoteDateVal = el("quoteDate").value;
  const quoteDate = quoteDateVal ? new Date(quoteDateVal + "T00:00:00") : new Date();

  const workingDows = getCheckedDows();
  const workingDays = countWorkingDaysInMonth(quoteDate, workingDows);

  const taxRate = Number(el("taxRate").value || 0) / 100;
  const roundTo = Number(el("roundTo").value || 0);

  const mSafe = Number(el("mSafe").value || 55);
  const mStd  = Number(el("mStd").value || 65);
  const mPrem = Number(el("mPrem").value || 75);

  let allocatedOverhead = 0;
  let overheadExplain = "";

  if(monthlyFixed > 0){
    if(workingDays <= 0){
      allocatedOverhead = 0;
      overheadExplain = "No working days selected, so overhead allocation is 0.";
    } else {
      const overheadPerWorkingDay = monthlyFixed / workingDays;

      if(mode === "retail"){
        const prodHours = Number(el("productionHours").value || 0);
        const hours = Math.max(0, prodHours);
        const hpday = Math.max(0.1, hoursPerDay || 8);
        const overheadPerHour = overheadPerWorkingDay / hpday;
        allocatedOverhead = overheadPerHour * hours;
        overheadExplain = `Overhead/month ÷ working days (${workingDays}) = ${overheadPerWorkingDay.toFixed(2)} per working day; ÷ hours/day (${hpday}) = ${overheadPerHour.toFixed(2)} per hour; × ${hours} hours.`;
      } else {
        const units = Math.max(1, Number(el("units").value || 1));
        // Allocate 1 working day of overhead across the batch (simple + practical)
        // If you prefer overhead per unit based on a chosen number of working days, you can extend this.
        allocatedOverhead = overheadPerWorkingDay / units;
        overheadExplain = `Overhead/month ÷ working days (${workingDays}) = ${overheadPerWorkingDay.toFixed(2)} per working day; ÷ ${units} units.`;
      }
    }
  } else {
    overheadExplain = isPremium ? "Monthly fixed expenses is 0, so overhead allocation is 0." : "Free mode: fixed-expense overhead is excluded.";
  }

  const preTaxCost = productionCost + extraExpenses + allocatedOverhead;

  const safePreTax = priceFromMargin(preTaxCost, mSafe);
  const stdPreTax  = priceFromMargin(preTaxCost, mStd);
  const premPreTax = priceFromMargin(preTaxCost, mPrem);

  const safeTaxIncl = roundNearest(safePreTax * (1 + taxRate), roundTo);
  const stdTaxIncl  = roundNearest(stdPreTax  * (1 + taxRate), roundTo);
  const premTaxIncl = roundNearest(premPreTax * (1 + taxRate), roundTo);

  el("outSafe").textContent = fmt(safeTaxIncl);
  el("outStd").textContent  = fmt(stdTaxIncl);
  el("outPrem").textContent = fmt(premTaxIncl);

  el("explain").textContent =
    `Total pre-tax cost = production (${productionCost}) + extras (${extraExpenses}) + overhead (${allocatedOverhead.toFixed(2)}). ` +
    `Working days in month: ${workingDays}. ` +
    overheadExplain;
}

function init(){
  syncModeUI();

  // default date = today
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()).padStart(2,"0");
  el("quoteDate").value = `${yyyy}-${mm}-${dd}`;

  setPremiumEditing(false);

  el("mode").addEventListener("change", () => { syncModeUI(); });
  el("isPremium").addEventListener("change", (e) => { setPremiumEditing(e.target.checked); });
  el("calcBtn").addEventListener("click", calc);

  // optional: auto-recalc on input
  document.querySelectorAll("input,select").forEach(node => {
    node.addEventListener("input", () => {
      // keep it light; you can comment this out if you only want button calc
      // calc();
    });
  });
}

init();
