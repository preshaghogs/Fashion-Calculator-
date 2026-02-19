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
    const dow = dt.getDay();
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

function priceFromMargin(preTaxCost, marginPct){
  const m = clamp(marginPct / 100, 0, 0.95);
  return preTaxCost / (1 - m);
}

function fmt(num){
  if(!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);
}

function setPremiumEditing(isPremium){
  el("monthlyFixed").disabled = !isPremium;
  el("mSafe").disabled = !isPremium;
  el("mStd").disabled  = !isPremium;
  el("mPrem").disabled = !isPremium;
}

function syncModeUI(){
  const mode = el("mode").value;
  el("retailHoursRow").style.display = mode === "retail" ? "flex" : "none";
  el("wholesaleUnitsRow").style.display = mode === "wholesale" ? "flex" : "none";
}

function randomCode(){
  // short, human-ish: FPP-YYMMDD-XXXX
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const xxxx = Math.random().toString(36).slice(2,6).toUpperCase();
  return `FPP-${yy}${mm}${dd}-${xxxx}`;
}

const STORE_KEY = "fpp_saved_quotes_v1";

function loadSaved(){
  try{
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  }catch{
    return [];
  }
}

function saveAll(list){
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function renderSaved(){
  const box = el("savedList");
  if(!box) return;

  const items = loadSaved();
  if(items.length === 0){
    box.innerHTML = `<div class="muted small">No saved quotes yet.</div>`;
    return;
  }

  box.innerHTML = items
    .sort((a,b) => b.createdAt - a.createdAt)
    .map(item => {
      const when = new Date(item.createdAt).toLocaleString();
      return `
        <div class="saved-item" data-id="${item.id}">
          <div class="saved-top">
            <div>
              <div class="code">${item.code}</div>
              <div class="muted small">${when} • ${item.mode}</div>
            </div>
            <div class="saved-actions">
              <button type="button" data-act="copy">Copy code</button>
              <button type="button" class="danger" data-act="delete">Delete</button>
            </div>
          </div>
          <div class="hr"></div>
          <div class="result-grid">
            <div class="res"><div class="label muted">Safe</div><div class="value">${fmt(item.safe)}</div></div>
            <div class="res"><div class="label muted">Standard</div><div class="value">${fmt(item.std)}</div></div>
            <div class="res"><div class="label muted">Premium</div><div class="value">${fmt(item.prem)}</div></div>
          </div>
        </div>
      `;
    })
    .join("");

  box.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const act = e.currentTarget.dataset.act;
      const card = e.currentTarget.closest(".saved-item");
      const id = card.dataset.id;

      if(act === "copy"){
        const item = loadSaved().find(x => x.id === id);
        if(item) navigator.clipboard?.writeText(item.code);
      }
      if(act === "delete"){
        const next = loadSaved().filter(x => x.id !== id);
        saveAll(next);
        renderSaved();
      }
    });
  });
}

let lastComputed = null;

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

  const code = randomCode();
  if(el("quoteCode")) el("quoteCode").value = code;

  lastComputed = {
    code,
    mode,
    safe: safeTaxIncl,
    std: stdTaxIncl,
    prem: premTaxIncl,
    createdAt: Date.now()
  };
}

function saveQuote(){
  if(!lastComputed){
    // force calculation first so results + code exist
    calc();
  }
  const item = {
    id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
    ...lastComputed
  };
  const list = loadSaved();
  list.push(item);
  saveAll(list);
  renderSaved();
}

function init(){
  syncModeUI();

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()).padStart(2,"0");
  el("quoteDate").value = `${yyyy}-${mm}-${dd}`;

  setPremiumEditing(false);

  el("mode").addEventListener("change", () => { syncModeUI(); });
  el("isPremium").addEventListener("change", (e) => { setPremiumEditing(e.target.checked); });
  el("calcBtn").addEventListener("click", calc);

  if(el("saveBtn")) el("saveBtn").addEventListener("click", saveQuote);

  renderSaved();
}

init();
    </section>
  </div>

  <script src="app.js"></script>
</body>
  </html>
