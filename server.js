const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'cache.db');
const db = new sqlite3.Database(DB_PATH);

// initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destination TEXT,
    radius INTEGER,
    lat REAL,
    lon REAL,
    data TEXT,
    ts INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS custom_spots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    lat REAL,
    lon REAL,
    description TEXT,
    owner TEXT,
    featured INTEGER DEFAULT 0,
    createdAt INTEGER
  )`);
});

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

function haversineKm(lat1, lon1, lat2, lon2){
  function toRad(x){ return x * Math.PI/180; }
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper: query sqlite cache
function getCache(destination, radius){
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM cache WHERE destination = ? AND radius = ?', [destination.toLowerCase(), radius], (err, row) => {
      if(err) return reject(err);
      resolve(row);
    });
  });
}

function setCache(destination, radius, lat, lon, data){
  return new Promise((resolve, reject) => {
    const ts = Date.now();
    const stmt = db.prepare('INSERT INTO cache (destination, radius, lat, lon, data, ts) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(destination.toLowerCase(), radius, lat, lon, JSON.stringify(data), ts, function(err){
      if(err) return reject(err);
      resolve(this.lastID);
    });
  });
}

// Overpass query builder
function buildOverpassQuery(lat, lon, radiusMeters){
  // Collect nodes/ways/relations for tourism/museum/viewpoint/historic/park/heritage
  return `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lon})[tourism=attraction];
  node(around:${radiusMeters},${lat},${lon})[tourism=museum];
  node(around:${radiusMeters},${lat},${lon})[tourism=viewpoint];
  node(around:${radiusMeters},${lat},${lon})[historic=monument];
  node(around:${radiusMeters},${lat},${lon})[leisure=park];
  node(around:${radiusMeters},${lat},${lon})[heritage];

  way(around:${radiusMeters},${lat},${lon})[tourism=attraction];
  way(around:${radiusMeters},${lat},${lon})[tourism=museum];
  way(around:${radiusMeters},${lat},${lon})[tourism=viewpoint];
  way(around:${radiusMeters},${lat},${lon})[historic=monument];
  way(around:${radiusMeters},${lat},${lon})[leisure=park];
  way(around:${radiusMeters},${lat},${lon})[heritage];

  relation(around:${radiusMeters},${lat},${lon})[tourism=attraction];
  relation(around:${radiusMeters},${lat},${lon})[tourism=museum];
  relation(around:${radiusMeters},${lat},${lon})[tourism=viewpoint];
  relation(around:${radiusMeters},${lat},${lon})[historic=monument];
  relation(around:${radiusMeters},${lat},${lon})[leisure=park];
  relation(around:${radiusMeters},${lat},${lon})[heritage];
);
out center qt;
`;
}

app.get('/api/nearby-spots', async (req, res) => {
  try{
    const destination = (req.query.destination || '').trim();
    const radiusKm = parseInt(req.query.radius || '5', 10);
    if(!destination) return res.status(400).json({ error: 'destination is required' });
    const radiusMeters = Math.max(1000, Math.min(radiusKm*1000, 50000));

    // Check cache
    const cached = await getCache(destination, radiusKm);
    if(cached && (Date.now() - cached.ts) < 24*60*60*1000){
      // parse cached data and include any custom spots within radius
      const base = JSON.parse(cached.data || '[]');
      // get custom spots within radius of cached lat/lon
      db.all('SELECT * FROM custom_spots', [], (err, rows) => {
        if(err) return res.json({ results: base });
        const extras = rows.filter(r => haversineKm(cached.lat, cached.lon, r.lat, r.lon) <= radiusKm).map(r => ({
          id: `custom_${r.id}`,
          name: r.name,
          category: r.category,
          lat: r.lat,
          lon: r.lon,
          distance_km: Number(haversineKm(cached.lat, cached.lon, r.lat, r.lon).toFixed(3)),
          source: 'custom',
          featured: Boolean(r.featured)
        }));
        return res.json({ cached: true, results: [...base, ...extras] });
      });
      return;
    }

    // get coordinates for destination using Nominatim
    const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'Wanderlust/1.0 (contact@example.com)';
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`;
    const nomResp = await fetch(nomUrl, { headers: { 'User-Agent': NOMINATIM_USER_AGENT, 'Accept': 'application/json' } });
    // Some errors from Nominatim/overpass return HTML (rate limit or maintenance). Check response
    if(!nomResp.ok){
      const txt = await nomResp.text().catch(()=>'<no body>');
      console.error('Nominatim error', nomResp.status, nomResp.statusText, txt.slice(0,800));
      return res.status(502).json({ error: 'geocoding failed', detail: `Nominatim ${nomResp.status} ${nomResp.statusText}` });
    }
    const contentType = (nomResp.headers.get('content-type') || '');
    if(!contentType.includes('application/json')){
      const txt = await nomResp.text().catch(()=>'<no body>');
      console.error('Nominatim returned non-json response:', contentType, txt.slice(0,800));
      return res.status(502).json({ error: 'geocoding failed', detail: 'Nominatim returned non-JSON response' });
    }
    let nomData;
    try{
      nomData = await nomResp.json();
    } catch(parseErr){
      const txt = await nomResp.text().catch(()=>'<no body>');
      console.error('Failed to parse Nominatim JSON', parseErr, txt.slice(0,800));
      return res.status(502).json({ error: 'geocoding failed', detail: 'Invalid JSON from Nominatim' });
    }
    if(!nomData || nomData.length === 0) return res.status(404).json({ error: 'destination not found' });
    const { lat, lon } = nomData[0];

    // Overpass
    const query = buildOverpassQuery(lat, lon, radiusMeters);
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const overpassResp = await fetch(overpassUrl, { method: 'POST', body: query, headers: { 'Content-Type': 'text/plain', 'Accept': 'application/json' } });
    if(!overpassResp.ok){
      const txt = await overpassResp.text().catch(()=>'<no body>');
      console.error('Overpass error', overpassResp.status, overpassResp.statusText, txt.slice(0,800));
      return res.status(502).json({ error: 'overpass failed', detail: `Overpass ${overpassResp.status} ${overpassResp.statusText}` });
    }
    const overpassContentType = (overpassResp.headers.get('content-type') || '');
    if(!overpassContentType.includes('application/json')){
      const txt = await overpassResp.text().catch(()=>'<no body>');
      console.error('Overpass returned non-json response:', overpassContentType, txt.slice(0,800));
      return res.status(502).json({ error: 'overpass failed', detail: 'Overpass returned non-JSON response' });
    }
    const overpassData = await overpassResp.json();

    const elems = (overpassData && overpassData.elements) || [];
    const results = elems.map(el => {
      const elLat = el.lat || (el.center && el.center.lat) || (el.bounds && el.bounds.center && el.bounds.center.lat) || null;
      const elLon = el.lon || (el.center && el.center.lon) || (el.bounds && el.bounds.center && el.bounds.center.lon) || null;
      const name = (el.tags && (el.tags.name || el.tags['name:en'])) || 'Unknown';
      const category = el.tags && (el.tags.tourism || el.tags.leisure || el.tags.historic || el.tags.heritage) || 'attraction';
      const distKm = (elLat && elLon) ? haversineKm(parseFloat(lat), parseFloat(lon), elLat, elLon) : null;
      return {
        id: `${el.type}_${el.id}`,
        name,
        category,
        lat: elLat,
        lon: elLon,
        distance_km: distKm ? Number(distKm.toFixed(3)) : null,
        source: 'osm',
        tags: el.tags || {}
      };
    }).filter(r => r.lat && r.lon && r.distance_km !== null).sort((a,b)=>a.distance_km - b.distance_km);

    // include custom spots that fall within radius
    db.all('SELECT * FROM custom_spots', [], (err, rows) => {
      if(err){
        // cache and return
        setCache(destination, radiusKm, parseFloat(lat), parseFloat(lon), results).catch(()=>{});
        return res.json({ cached: false, results });
      }
      const extras = rows.filter(r => haversineKm(parseFloat(lat), parseFloat(lon), r.lat, r.lon) <= radiusKm).map(r => ({
        id: `custom_${r.id}`,
        name: r.name,
        category: r.category,
        lat: r.lat,
        lon: r.lon,
        distance_km: Number(haversineKm(parseFloat(lat), parseFloat(lon), r.lat, r.lon).toFixed(3)),
        source: 'custom',
        featured: Boolean(r.featured)
      }));

      const combined = [...results, ...extras];
      // cache result
      setCache(destination, radiusKm, parseFloat(lat), parseFloat(lon), combined).catch(()=>{});
      res.json({ cached: false, results: combined });
    });

  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

// Admin: add custom spot
app.post('/api/nearby-spots/custom', (req, res) => {
  const role = req.header('x-role') || '';
  if(role !== 'admin') return res.status(403).json({ error: 'admin role required' });
  const { name, category, lat, lon, description } = req.body;
  if(!name || !lat || !lon) return res.status(400).json({ error: 'name, lat and lon required' });
  const stmt = db.prepare('INSERT INTO custom_spots (name, category, lat, lon, description, owner, featured, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(name, category || 'custom', lat, lon, description || '', req.header('x-user') || 'admin', 0, Date.now(), function(err){
    if(err) return res.status(500).json({ error: 'db error' });
    res.json({ id: this.lastID, success: true });
  });
});

// Admin: toggle featured flag
app.post('/api/nearby-spots/feature', (req, res) => {
  const role = req.header('x-role') || '';
  if(role !== 'admin') return res.status(403).json({ error: 'admin role required' });
  const { id, featured } = req.body;
  if(!id) return res.status(400).json({ error: 'id required' });
  // id should be custom_<n>
  const match = String(id).match(/^custom_(\d+)$/);
  if(!match) return res.status(400).json({ error: 'only custom spots may be featured via API' });
  const cid = parseInt(match[1], 10);
  db.run('UPDATE custom_spots SET featured = ? WHERE id = ?', [featured ? 1 : 0, cid], function(err){
    if(err) return res.status(500).json({ error: 'db error' });
    res.json({ success: true });
  });
});

// Serve static files (so nearby-spots.html can be opened from browser)
app.use('/', express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
  console.log(`Wanderlust server listening on http://localhost:${PORT}`);
});
