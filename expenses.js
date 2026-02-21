let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let members = JSON.parse(localStorage.getItem("members")) || [];

// Set group size
function setMembers() {
  const count = Number(document.getElementById("memberCount").value);
  if (!count || count < 2) return alert("Enter at least 2 members");

  members = [];
  const container = document.getElementById("memberInputs");
  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const input = document.createElement("input");
    input.placeholder = "Member " + (i + 1) + " name";
    input.className = "member-name";
    container.appendChild(input);
  }

  document.getElementById("saveMembersBtn").style.display = "inline-block";
}

// Save member names
function saveMembers() {
  const inputs = document.querySelectorAll(".member-name");
  members = [...inputs].map(i => i.value.trim()).filter(v => v);
  if (members.length < 2) return alert("Enter all member names");

  localStorage.setItem("members", JSON.stringify(members));
  renderPayerOptions();
  alert("Members saved!");
}

// Populate payer dropdown
function renderPayerOptions() {
  const payer = document.getElementById("payer");
  payer.innerHTML = `<option value="">Who paid?</option>`;
  members.forEach(m => {
    payer.innerHTML += `<option>${m}</option>`;
  });
}

// Add expense
function addExpense() {
  const amt = Number(document.getElementById("amount").value);
  const payer = document.getElementById("payer").value;

  if (!amt || !payer) return alert("Enter amount & payer");

  expenses.push({ amount: amt, paidBy: payer });
  localStorage.setItem("expenses", JSON.stringify(expenses));
  document.getElementById("amount").value = "";

  renderExpenses();
}

// Show expense list
function renderExpenses() {
  const list = document.getElementById("expenseList");
  list.innerHTML = "";

  let total = 0;
  expenses.forEach(e => {
    total += e.amount;
    list.innerHTML += `<div>${e.paidBy} paid ₹${e.amount}</div>`;
  });

  const perPerson = total / members.length;
  calculateSettlements(perPerson);
}

// Settlement logic
function calculateSettlements(perPerson) {
  let balance = {};
  members.forEach(m => balance[m] = -perPerson);

  expenses.forEach(e => balance[e.paidBy] += e.amount);

  let text = "Settlements:\n";
  for (let m in balance) {
    if (balance[m] > 0) text += `${m} should receive ₹${balance[m].toFixed(2)}\n`;
    if (balance[m] < 0) text += `${m} owes ₹${Math.abs(balance[m]).toFixed(2)}\n`;
  }

  document.getElementById("splitResult").innerText = text;
}
function resetAll() {
  if (!confirm("This will delete all members and expenses. Continue?")) return;

  // Clear data
  expenses = [];
  members = [];

  localStorage.removeItem("expenses");
  localStorage.removeItem("members");

  // Clear UI
  document.getElementById("expenseList").innerHTML = "";
  document.getElementById("splitResult").innerText = "";
  document.getElementById("memberInputs").innerHTML = "";
  document.getElementById("payer").innerHTML = `<option value="">Who paid?</option>`;
  document.getElementById("memberCount").value = "";

  alert("Group reset successful!");
}

// On page load
window.onload = () => {
  if (members.length) renderPayerOptions();
  renderExpenses();
};
