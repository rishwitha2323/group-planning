// ===== Global Data =====
let data = JSON.parse(localStorage.getItem("itineraryData")) || { pool: [], days: {} };

// ===== Save Data =====
function saveData() {
  localStorage.setItem("itineraryData", JSON.stringify(data));
}

// ===== Create Days =====
window.createDays = function () {
  const count = Number(document.getElementById("dayCount").value);
  if (!count || count < 1) return alert("Enter valid number of days");

  // Initialize day arrays dynamically
  data.days = {};
  for (let i = 1; i <= count; i++) {
    data.days["Day " + i] = [];
  }

  saveData();
  renderAll();
};

// ===== Add Activity =====
window.createActivity = function () {
  const input = document.getElementById("newActivity");
  const val = input.value.trim();
  if (!val) return;

  data.pool.push(val);
  saveData();
  input.value = "";
  renderAll();
};

// ===== Make Activity Draggable =====
function makeDraggable(div) {
  div.draggable = true;
  div.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text", div.textContent);
    e.dataTransfer.setData("source", div.parentElement.id);
  });
}

// ===== Render Everything =====
function renderAll() {
  renderPool();
  renderDays();
}

// ===== Render Pool =====
function renderPool() {
  const pool = document.getElementById("activityPool");
  pool.innerHTML = "";
  data.pool.forEach(text => {
    const div = document.createElement("div");
    div.className = "activity";
    div.textContent = text;
    makeDraggable(div);
    pool.appendChild(div);
  });
}

// ===== Render Days Dynamically =====
function renderDays() {
  const container = document.getElementById("daysContainer");
  container.innerHTML = "";

  Object.keys(data.days).forEach(day => {
    // Day title
    const title = document.createElement("h4");
    title.textContent = day;
    container.appendChild(title);

    // Dropzone for this day
    const zone = document.createElement("div");
    zone.id = day;
    zone.className = "timeline dropzone";
    zone.addEventListener("dragover", e => e.preventDefault());
    zone.addEventListener("drop", dropActivity);

    // Populate activities for this day
    data.days[day].forEach(text => {
      const div = document.createElement("div");
      div.className = "activity";
      div.textContent = text;
      makeDraggable(div);
      zone.appendChild(div);
    });

    container.appendChild(zone);
  });
}

// ===== Handle Drop =====
function dropActivity(e) {
  e.preventDefault();
  const text = e.dataTransfer.getData("text");
  const target = e.currentTarget.id;

  // Remove from pool and all days
  data.pool = data.pool.filter(a => a !== text);
  Object.keys(data.days).forEach(d => {
    data.days[d] = data.days[d].filter(a => a !== text);
  });

  // Add to target
  if (target === "activityPool") data.pool.push(text);
  else data.days[target].push(text);

  saveData();
  renderAll();
}

// ===== Enable drop on pool =====
document.addEventListener("DOMContentLoaded", () => {
  const pool = document.getElementById("activityPool");
  pool.addEventListener("dragover", e => e.preventDefault());
  pool.addEventListener("drop", dropActivity);

  // Render existing data on load
  renderAll();
});

// ===== Reset All =====
window.resetAll = function () {
  if (!confirm("Are you sure you want to reset everything?")) return;

  // Reset global data
  data = { pool: [], days: {} };
  localStorage.removeItem("itineraryData");

  // Clear input fields
  document.getElementById("dayCount").value = "";
  document.getElementById("newActivity").value = "";

  // Re-render UI (pool and days will now be empty)
  renderAll();
};

