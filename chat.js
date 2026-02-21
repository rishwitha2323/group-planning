const chatInput = document.getElementById("chatInput");
const chatBox = document.getElementById("chatBox");

// Get username from stored user email
const userEmail = localStorage.getItem("user") || "Guest";
const username = userEmail.split("@")[0];

// Load previous messages from localStorage
let chatMessages = JSON.parse(localStorage.getItem("chatMessages")) || [];
renderChat();

// Send message on Enter
chatInput.addEventListener("keypress", e => {
  if(e.key === "Enter" && chatInput.value.trim()){
    const msg = {
      name: username,
      text: chatInput.value.trim(),
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    chatMessages.push(msg);
    localStorage.setItem("chatMessages", JSON.stringify(chatMessages));
    renderChat();
    chatInput.value = "";
  }
});

// Render chat messages
function renderChat() {
  chatBox.innerHTML = "";
  chatMessages.forEach(msg => {
    const p = document.createElement("p");
    p.innerHTML = `<b>${msg.name}:</b> ${msg.text} <span style="font-size:0.7em;color:#666;">${msg.time}</span>`;
    chatBox.appendChild(p);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}
