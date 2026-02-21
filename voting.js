// Load poll when page opens
document.addEventListener("DOMContentLoaded", loadPoll);

// Create Poll
function createPoll() {
  const question = document.getElementById("pollQuestion").value.trim();
  const options = [
    document.getElementById("option1").value.trim(),
    document.getElementById("option2").value.trim(),
    document.getElementById("option3").value.trim()
  ].filter(o => o !== "");

  if (!question || options.length < 2) {
    alert("Enter question and at least 2 options");
    return;
  }

  const poll = {
    question: question,
    options: options,
    votes: new Array(options.length).fill(0),
    voters: []   // To prevent multiple votes
  };

  localStorage.setItem("poll", JSON.stringify(poll));
  loadPoll();
}

// Vote
function votePoll(index) {
  const user = localStorage.getItem("user") || "guest";
  let poll = JSON.parse(localStorage.getItem("poll"));

  if (!poll) return;

  if (poll.voters.includes(user)) {
    alert("You already voted!");
    return;
  }

  poll.votes[index]++;
  poll.voters.push(user);

  localStorage.setItem("poll", JSON.stringify(poll));
  loadPoll();
}

// Display Poll
function loadPoll() {
  const poll = JSON.parse(localStorage.getItem("poll"));
  const area = document.getElementById("pollArea");
  if (!area) return;

  area.innerHTML = "";

  if (!poll) return;

  const totalVotes = poll.votes.reduce((a, b) => a + b, 0);

  let html = `<div class="poll-box"><h4>${poll.question}</h4>`;

  poll.options.forEach((opt, i) => {
    const percent = totalVotes ? (poll.votes[i] / totalVotes) * 100 : 0;

    html += `
      <div class="poll-option">
        ${opt} (${poll.votes[i]} votes)
        <button onclick="votePoll(${i})">Vote</button>
        <div class="result-bar" style="width:${percent}%"></div>
      </div>
    `;
  });

  html += `</div>`;
  area.innerHTML = html;
}
