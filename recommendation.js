// Open Google Maps directions
function calculateRoute() {
  const from = document.getElementById("fromLocation").value.trim();
  const to = document.getElementById("toLocation").value.trim();
  if (!from || !to) { alert('Please enter both locations'); return; }
  const mapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
  window.open(mapsUrl, "_blank");
}

// Fetch nearby recommendations from server and render
async function getRecommendations(){
  const destEl = document.getElementById('recommendDestination');
  const radiusEl = document.getElementById('recommendRadius');
  const container = document.getElementById('nearbyRecommendations');
  const dest = destEl && destEl.value.trim();
  const radius = radiusEl && radiusEl.value;
  if(!dest){ alert('Enter destination'); return; }
  container.innerHTML = '<p style="grid-column:1/-1;color:#666;">Searching for nearby spots...</p>';
  try{
    // determine backend base URL: prefer same origin if server is running there, otherwise fallback to localhost:3001
    const sameOriginPort = window.location.port;
    let base = '';
    if(sameOriginPort === '3001') base = '';
    else base = 'http://localhost:3001';

    const url = `${base}/api/nearby-spots?destination=${encodeURIComponent(dest)}&radius=${encodeURIComponent(radius)}`;
    console.debug('Fetching nearby spots from', url);
    const resp = await fetch(url);
    if(!resp.ok){
      const text = await resp.text().catch(()=>null);
      console.error('Nearby API responded with', resp.status, resp.statusText, text);
      throw new Error(`API ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json();
    const results = data.results || [];
    if(results.length === 0){ container.innerHTML = '<p style="grid-column:1/-1;color:#666;">No recommendations found.</p>'; return; }
    renderRecommendations(results);
  }catch(err){
    console.error('Failed to fetch recommendations', err);
    container.innerHTML = `<p style="grid-column:1/-1;color:#c0392b;">Failed to fetch recommendations. See console for details.</p>`;
  }
}

function renderRecommendations(results){
  const container = document.getElementById('nearbyRecommendations');
  container.innerHTML = '';
  results.forEach(r => {
    const card = document.createElement('div');
    card.className = 'recommend-card';
    card.style = 'background:#fff;padding:12px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);';

    const title = document.createElement('h4');
    title.innerText = r.name || 'Unknown';
    title.style.margin = '0 0 6px 0';
    title.style.fontSize = '16px';

    const meta = document.createElement('div');
    meta.innerText = `${r.category || 'Attraction'} · ${r.distance_km ? r.distance_km + ' km' : '—'}`;
    meta.style.color = '#666';
    meta.style.fontSize = '13px';
    meta.style.marginBottom = '8px';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const showBtn = document.createElement('button');
    showBtn.innerText = 'Show on Map';
    showBtn.style = 'padding:6px 10px;border-radius:6px;background:#2563eb;color:#fff;border:none;cursor:pointer;';
    showBtn.onclick = () => {
      if(r.lat && r.lon){
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.lat + ',' + r.lon)}`;
        window.open(mapsUrl, '_blank');
      } else {
        // fallback: search by name
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name || '')}`;
        window.open(mapsUrl, '_blank');
      }
    };

    const addBtn = document.createElement('button');
    addBtn.innerText = 'Add to Want to Visit';
    addBtn.style = 'padding:6px 10px;border-radius:6px;background:#f59e0b;color:#000;border:none;cursor:pointer;';
    addBtn.onclick = () => addToWant(r);

    actions.appendChild(showBtn);
    actions.appendChild(addBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(actions);

    // hover effect
    card.onmouseenter = () => { card.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'; card.style.transform='translateY(-3px)'; card.style.transition='all 160ms ease'; };
    card.onmouseleave = () => { card.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; card.style.transform='none'; };

    container.appendChild(card);
  });
}

function addToWant(spot){
  const key = 'wantToVisit';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  if(list.find(x=>x.id === spot.id)) { alert('Already added'); return; }
  list.push(spot);
  localStorage.setItem(key, JSON.stringify(list));
  alert('Added to Want to Visit');
}