document.addEventListener("DOMContentLoaded", () => {
  const userEmail = localStorage.getItem("user");
  if (!userEmail) {
    window.location.href = "login.html";
    return;
  }
  const name = userEmail.split("@")[0];
  const welcome = document.getElementById("welcomeText");
  if (welcome) welcome.innerText = "Hello, " + name + " 👋";

  renderActivities();
  displayTripDetails();

  // If tourist-guide, populate organizer selector so guide can load an organizer's trip
  if(localStorage.getItem('role') === 'tourist-guide'){
    populateGuideOrganizers();
  }
});

const _currentUserForActivities = localStorage.getItem('user');
let activities = JSON.parse(localStorage.getItem(`tripActivities_${_currentUserForActivities}`) || localStorage.getItem("tripActivities") || '[]') || [];

function getUsers(){
  return JSON.parse(localStorage.getItem('users') || '[]');
}

function tripKeyFor(owner){
  return `tripDetails_${owner}`;
}

function logout() {
  // Clear session data
  localStorage.removeItem("user");
  localStorage.removeItem("role");
  localStorage.removeItem("loginTime");
  
  // Optionally clear some session-specific data, but keep trip and user lists
  window.location.href = "login.html";
}

function addActivity() {
  const input = document.getElementById("activityInput");
  const inputText = input.value.trim();
  const fileInput = document.getElementById('activityPhoto');
  const file = fileInput && fileInput.files && fileInput.files[0];

  // Require either text or a photo
  if (!inputText && !file) return;

  const pushAndSave = (item) => {
    activities.push(item);
    const key = `tripActivities_${localStorage.getItem('user') || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(activities));
    // clear inputs
    input.value = "";
    if(fileInput) fileInput.value = '';
    renderActivities();
  };

  if(file){
    const reader = new FileReader();
    reader.onload = function(e){
      const dataUrl = e.target.result;
      pushAndSave({ text: inputText, photo: dataUrl });
    };
    reader.readAsDataURL(file);
  } else {
    pushAndSave({ text: inputText });
  }
}

function renderActivities() {
  const list = document.getElementById("activityList");
  list.innerHTML = "";

  const key = `tripActivities_${localStorage.getItem('user') || 'guest'}`;
  activities = JSON.parse(localStorage.getItem(key) || localStorage.getItem("tripActivities") || '[]') || [];

  activities.forEach((a, i) => {
    // support legacy string activities and new object activities
    let text = '';
    let photo = null;
    if (typeof a === 'string') text = a;
    else if (typeof a === 'object') { text = a.text || ''; photo = a.photo || null; }

    list.innerHTML += `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
        <div style="flex:1;">
          ✔ <span style="vertical-align:middle">${escapeHtml(text)}</span>
          ${photo ? `<div style=\"margin-top:6px;\"><img src=\"${photo}\" style=\"max-width:160px;max-height:120px;border-radius:6px;border:1px solid #ddd;\"/></div>` : ''}
        </div>
        <div><button onclick="removeActivity(${i})" style="background:red;color:white;border:none;padding:6px 8px;border-radius:4px;">✖</button></div>
      </div>`;
  });
}

function removeActivity(i) {
  activities.splice(i, 1);
  const key = `tripActivities_${localStorage.getItem('user') || 'guest'}`;
  localStorage.setItem(key, JSON.stringify(activities));
  renderActivities();
}

function saveTripDetails() {
  const role = localStorage.getItem('role');
  const owner = localStorage.getItem('user');
  if(role !== 'organizer') { alert('Only organizers can save trip details'); return; }

  const name = document.getElementById("tripName").value.trim();
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  const members = document.getElementById("tripMembers").value;
  const hotel = document.getElementById("hotelName").value.trim();

  if (!name || !start || !end || !members || !hotel) {
    alert("Fill all trip details");
    return;
  }

  // Get the latest activities from localStorage
  const activities = JSON.parse(localStorage.getItem(`tripActivities_${owner}`) || '[]');

  const trip = { name, start, end, members, hotel, activities, owner };
  localStorage.setItem(tripKeyFor(owner), JSON.stringify(trip));

  // Immediately display saved trip
  displayTripDetails();
}

function displayTripDetails() {
  const role = localStorage.getItem('role');
  const user = localStorage.getItem('user');

  let trip = null;
  if(role === 'organizer'){
    trip = JSON.parse(localStorage.getItem(tripKeyFor(user)) || 'null');
  } else if(role === 'teammate'){
    // show trip of their organizer (addedBy)
    const users = getUsers();
    const me = users.find(u => u.email === user);
    const organizer = me && me.addedBy ? me.addedBy : null;
    if(organizer) trip = JSON.parse(localStorage.getItem(tripKeyFor(organizer)) || 'null');
  } else if(role === 'tourist-guide'){
    // tourist-guide: default show first organizer trip if available
    const users = getUsers();
    const orgUser = users.find(u => u.role === 'organizer');
    if(orgUser) trip = JSON.parse(localStorage.getItem(tripKeyFor(orgUser.email)) || 'null');
  } else {
    // admin or others: show global tripDetails if present
    trip = JSON.parse(localStorage.getItem('tripDetails') || 'null');
  }

  if (!trip){
    document.getElementById("tripNameDisplay").innerText = "No Trip Set";
    document.getElementById("tripDetailsDisplay").innerText = "Enter trip details below";
    document.getElementById('activityList').innerHTML = '';
    return;
  }

  document.getElementById("tripNameDisplay").innerText = trip.name;
  document.getElementById("tripDetailsDisplay").innerText =
    formatDate(trip.start) + " – " + formatDate(trip.end) +
    " | " + trip.members + " Members | 🏨 " + trip.hotel;

  activities = trip.activities || [];
  localStorage.setItem(`tripActivities_${trip.owner || user}`, JSON.stringify(activities));
  renderActivities();
}

// --- Tourist guide helpers ---
function populateGuideOrganizers(){
  const select = document.getElementById('organizerSelect');
  if(!select) return;
  // Populate organizers from users list (only organizers). This ensures guides see only organizers (login details + location).
  const users = getUsers();
  const organizers = users.filter(u => u.role === 'organizer');
  select.innerHTML = '';
  if(organizers.length === 0){
    select.innerHTML = '<option value="">No organizers available</option>';
    return;
  }
  select.innerHTML = '<option value="">-- Select organizer --</option>' + organizers.map(o=>{
    // Prefer trip hotel if available
    let displayLoc = o.location || '';
    try{
      const tripJson = localStorage.getItem(`tripDetails_${o.email}`);
      if(tripJson){
        const trip = JSON.parse(tripJson);
        if(trip && trip.hotel) displayLoc = trip.hotel;
      }
    }catch(e){}
    return `<option value="${o.email}">${o.email} ${displayLoc?`(${displayLoc})`:''}</option>`;
  }).join('');
  const btn = document.getElementById('loadOrganizerTrip');
  if(btn){
    btn.onclick = () => {
      const sel = select.value;
      if(!sel){ alert('Select an organizer'); return; }
      // Try to render organizer's trip if saved; if not, still show organizer login/location info in guide panel
      renderGuideTripForOrganizer(sel);
    };
  }
}

function renderGuideTripForOrganizer(ownerEmail){
  const guideContainer = document.getElementById('guideTripDetails');
  if(!guideContainer) return;
  const trip = JSON.parse(localStorage.getItem(tripKeyFor(ownerEmail)) || 'null');
  if(!trip){ guideContainer.innerHTML = '<p style="color:#666;">Organizer has not set a trip yet.</p>'; return; }
  let activitiesHtml = '';
  (trip.activities || []).forEach(a => {
    let text = '';
    let photo = null;
    if (typeof a === 'string') text = a;
    else if (typeof a === 'object') { text = a.text || ''; photo = a.photo || null; }
    activitiesHtml += `<li style="margin-bottom:6px;">${escapeHtml(text)}${photo?`<div style=\"margin-top:6px;\"><img src=\"${photo}\" style=\"max-width:220px;max-height:160px;border-radius:6px;border:1px solid #ddd;\"/></div>`:''}</li>`;
  });

  let html = `<div style="padding:12px;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <h4 style="margin:0 0 6px 0">${escapeHtml(trip.name)}</h4>
    <div style="color:#666;font-size:13px;margin-bottom:8px">${formatDate(trip.start)} – ${formatDate(trip.end)} · ${trip.members} members · 🏨 ${escapeHtml(trip.hotel)}</div>
    <div><strong>Activities</strong><ul style="margin:6px 0 0 18px;">${activitiesHtml}</ul></div>
  </div>`;
  guideContainer.innerHTML = html;
  // Also populate nearbyMembers area for this organizer so guides can see travelers near the organizer's hotel/location
  const nearbyContainer = document.getElementById('nearbyMembers');
  if(nearbyContainer){
    const organizerLoc = trip.hotel || '';
    if(!organizerLoc){
      nearbyContainer.innerHTML = '<p style="color:#666;">No organizer location set for this trip.</p>';
    } else {
      const users = getUsers();
      const nearby = users.filter(u => u.location && u.location.toLowerCase().includes(organizerLoc.toLowerCase()));
      if(nearby.length === 0){
        nearbyContainer.innerHTML = `<p style=\"color:#666;\">📍 <strong>Organizer Location:</strong> ${organizerLoc}<br>No members found near this location yet.</p>`;
      } else {
        let h = `<p style=\"margin-bottom:10px;\"><strong>📍 Organizer Location:</strong> ${organizerLoc}</p>`;
        h += '<div><h4>Members Nearby (' + nearby.length + ')</h4><ul style="list-style:none;padding:0;">';
        nearby.forEach(u => {
          const roleEmoji = { 'teammate': '👥', 'organizer': '📋', 'tourist-guide': '🗺️', 'admin': '🛠️' }[u.role] || '👤';
          h += `<li style="padding:10px;background:#f9f9f9;margin:5px 0;border-radius:4px;border-left:4px solid #FF6B6B;">${roleEmoji} ${u.email} (${u.role})<br><small style="color:#666;">📍 ${u.location}</small></li>`;
        });
        h += '</ul></div>';
        nearbyContainer.innerHTML = h;
      }
    }
  }
}

function resetAll() {
  localStorage.clear();
  activities = [];
  document.querySelectorAll(".trip-form input").forEach(i => i.value = "");
  document.getElementById("activityList").innerHTML = "";
  document.getElementById("tripNameDisplay").innerText = "No Trip Set";
  document.getElementById("tripDetailsDisplay").innerText = "Enter trip details below";
}

// Small helper to escape HTML when rendering activity text
function escapeHtml(unsafe) {
  if(!unsafe) return '';
  return unsafe.replace(/[&<"'>]/g, function(m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"})[m]; });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// --- Trip photos: store per-owner under tripPhotos_<ownerEmail>
function getTripPhotos(owner){
  if(!owner) owner = localStorage.getItem('user');
  try{
    return JSON.parse(localStorage.getItem(`tripPhotos_${owner}`) || '[]');
  }catch(e){ return []; }
}

function saveTripPhotos(owner, arr){
  if(!owner) owner = localStorage.getItem('user');
  localStorage.setItem(`tripPhotos_${owner}`, JSON.stringify(arr || []));
}

async function addTripPhotos(){
  // Determine which organizer's trip the photos should be attached to.
  const title = (document.getElementById('photoTitle') && document.getElementById('photoTitle').value.trim()) || '';
  const filesEl = document.getElementById('photoFiles');
  if(!filesEl || !filesEl.files || filesEl.files.length === 0){ alert('Select one or more image files'); return; }
  // Choose owner intelligently: organizer -> self, teammate -> their organizer (addedBy), tourist-guide -> selected organizer in dropdown (or first organizer), admin/other -> first organizer if available
  function determinePhotoOwner(){
    const role = localStorage.getItem('role');
    const user = localStorage.getItem('user');
    const users = getUsers();
    if(role === 'organizer') return user;
    if(role === 'teammate'){
      const me = users.find(u => u.email === user);
      return (me && me.addedBy) ? me.addedBy : user;
    }
    if(role === 'tourist-guide'){
      const sel = document.getElementById('organizerSelect');
      if(sel && sel.value) return sel.value;
      const org = users.find(u => u.role === 'organizer');
      return org ? org.email : user;
    }
    // admin or fallback: attach to first organizer if exists
    const org = users.find(u => u.role === 'organizer');
    return org ? org.email : user;
  }

  const owner = determinePhotoOwner();
  if(!owner){ alert('Could not determine organizer to attach photos to'); return; }

  const files = Array.from(filesEl.files);
  // read all files as data URLs
  const reads = files.map(f => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Failed to read file'));
    r.readAsDataURL(f);
  }));

  let dataUrls = [];
  try{
    dataUrls = await Promise.all(reads);
  }catch(e){ alert('Failed to read one or more files'); return; }

  const existing = getTripPhotos(owner);
  const uploader = localStorage.getItem('user') || 'anonymous';
  existing.unshift({ title: title || 'Untitled', photos: dataUrls, uploadedAt: new Date().toISOString(), uploadedBy: uploader });
  saveTripPhotos(owner, existing);

  // clear inputs
  document.getElementById('photoTitle').value = '';
  if(filesEl) filesEl.value = '';

  renderTripPhotos(owner);
  alert('Photos added to trip');
}

function renderTripPhotos(owner){
  if(!owner) owner = localStorage.getItem('user');
  const container = document.getElementById('tripPhotosContainer');
  if(!container) return;
  const items = getTripPhotos(owner);
  if(!items || items.length === 0){ container.innerHTML = '<p style="color:#666;">No photos added for this trip yet.</p>'; return; }

  let html = '';
  items.forEach((block, idx) => {
    const date = block.uploadedAt ? new Date(block.uploadedAt).toLocaleString() : '';
    const uploader = block.uploadedBy || 'unknown';
    // delete block button shown conditionally via permission check in onclick handler
    html += `<div style="background:#fff;padding:10px;border-radius:8px;border:1px solid #eee;position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div style="font-weight:600">${escapeHtml(block.title)} <small style=\"color:#888;font-weight:400;\">${date}</small></div><div style=\"font-size:12px;color:#666;\">Uploaded by: ${escapeHtml(uploader)}</div></div>
      <div style=\"display:flex;gap:8px;flex-wrap:wrap;\">${(block.photos||[]).map((p,pi)=>`<div style=\"position:relative;\"><a href=\"${p}\" target=\"_blank\" rel=\"noopener\"><img src=\"${p}\" style=\"width:100%;max-width:180px;height:auto;border-radius:6px;border:1px solid #ddd;\"/></a><button onclick=\"deleteTripPhotoImage('${owner}', ${idx}, ${pi})\" style=\"position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;\">✖</button></div>`).join('')}</div>
      <div style=\"margin-top:8px;text-align:right;\"><button onclick=\"deleteTripPhotoBlock('${owner}', ${idx})\" style=\"background:#e74c3c;color:white;border:none;padding:6px 8px;border-radius:6px;\">Delete Photo Group</button></div>
    </div>`;
  });
  container.innerHTML = html;
}

// Ensure trip photos are shown when trip details are displayed
const _origDisplayTripDetails = displayTripDetails;
displayTripDetails = function(){
  _origDisplayTripDetails();
  // determine owner shown
  const role = localStorage.getItem('role');
  const user = localStorage.getItem('user');
  let owner = user;
  if(role === 'teammate'){
    const users = getUsers();
    const me = users.find(u=>u.email === user);
    owner = me && me.addedBy ? me.addedBy : user;
  } else if(role === 'tourist-guide'){
    // tourist-guide default: first organizer (but guide can load specific organizer via UI)
    const users = getUsers();
    const orgUser = users.find(u => u.role === 'organizer');
    owner = orgUser ? orgUser.email : user;
  }
  renderTripPhotos(owner);
};

// Add trip photos rendering into guide view when loading organizer
const _origRenderGuide = renderGuideTripForOrganizer;
renderGuideTripForOrganizer = function(ownerEmail){
  _origRenderGuide(ownerEmail);
  // render photos for this organizer under the guide trip details
  const guideContainer = document.getElementById('guideTripDetails');
  if(!guideContainer) return;
  const photosHtmlContainer = document.createElement('div');
  photosHtmlContainer.style.marginTop = '10px';
  const items = getTripPhotos(ownerEmail);
  if(!items || items.length === 0){
    photosHtmlContainer.innerHTML = '<p style="color:#666;">No photos added for this organizer.</p>';
  } else {
    let h = '<h4 style="margin:8px 0 6px 0">Trip Photos</h4>';
    items.forEach((block, idx) => {
      const date = block.uploadedAt ? new Date(block.uploadedAt).toLocaleString() : '';
      const uploader = block.uploadedBy || 'unknown';
      h += `<div style="background:#fff;padding:8px;border-radius:6px;border:1px solid #eee;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div style="font-weight:600">${escapeHtml(block.title)} <small style='color:#888;font-weight:400;'>${date}</small></div><div style='font-size:12px;color:#666;'>Uploaded by: ${escapeHtml(uploader)}</div></div>
        <div style='display:flex;gap:8px;flex-wrap:wrap;'>${(block.photos||[]).map((p,pi)=>`<div style="position:relative;"><a href=\"${p}\" target=\"_blank\" rel=\"noopener\"><img src=\"${p}\" style=\"width:120px;height:auto;border-radius:6px;border:1px solid #ddd;\"/></a><button onclick=\"deleteTripPhotoImage('${ownerEmail}', ${idx}, ${pi})\" style=\"position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;\">✖</button></div>`).join('')}</div>
        <div style='margin-top:8px;text-align:right;'><button onclick="deleteTripPhotoBlock('${ownerEmail}', ${idx})" style="background:#e74c3c;color:white;border:none;padding:6px 8px;border-radius:6px;">Delete Photo Group</button></div>
      </div>`;
    });
    photosHtmlContainer.innerHTML = h;
  }
  guideContainer.appendChild(photosHtmlContainer);
};

// Delete helpers
function canModifyPhotos(owner, block){
  // Per user request: allow any logged-in user to delete photos.
  const current = localStorage.getItem('user');
  return !!current; // true if someone is logged in
}

function deleteTripPhotoBlock(owner, idx){
  const items = getTripPhotos(owner);
  const block = items[idx];
  if(!block){ alert('Photo group not found'); return; }
  if(!canModifyPhotos(owner, block)){ alert('You do not have permission to delete this photo group'); return; }
  if(!confirm('Delete this photo group? This cannot be undone.')) return;
  items.splice(idx, 1);
  saveTripPhotos(owner, items);
  // refresh UI
  renderTripPhotos(owner);
}

function deleteTripPhotoImage(owner, blockIndex, imageIndex){
  const items = getTripPhotos(owner);
  const block = items[blockIndex];
  if(!block){ alert('Photo group not found'); return; }
  if(!canModifyPhotos(owner, block)){ alert('You do not have permission to delete this photo'); return; }
  if(!block.photos || !block.photos[imageIndex]){ alert('Photo not found'); return; }
  if(!confirm('Delete this photo? This cannot be undone.')) return;
  block.photos.splice(imageIndex, 1);
  // if block has no photos left, remove the block
  if(!block.photos || block.photos.length === 0){ items.splice(blockIndex,1); }
  saveTripPhotos(owner, items);
  renderTripPhotos(owner);
}



