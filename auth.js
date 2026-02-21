// Simple client-side auth & role helpers
(function(){
  // Role Permission System
  const rolePermissions = {
    'admin': ['view_all_users', 'view_login_activity', 'view_dashboard', 'manage_accounts'],
    'organizer': ['add_teammate', 'create_trip', 'manage_trip', 'view_dashboard', 'view_teammates'],
    'teammate': ['view_trip', 'view_chat', 'view_expenses', 'vote'],
    'tourist-guide': ['view_nearby_members', 'view_members_by_location', 'view_trip_location']
  };

  function hasPermission(role, permission) {
    const perms = rolePermissions[role] || [];
    return perms.includes(permission);
  }

  function getUsers(){
    return JSON.parse(localStorage.getItem('users') || '[]');
  }

  function saveUsers(users){
    localStorage.setItem('users', JSON.stringify(users));
  }

  function lockdownTeammate(email, role) {
    // Teammates cannot have add actions available
    if(role === 'teammate') {
      const addBtn = document.querySelector('[onclick="addTeammate()"]');
      const inputs = document.querySelectorAll('#newTeammateEmail, #newTeammateLocation');
      if(addBtn) addBtn.disabled = true;
      inputs.forEach(inp => inp && (inp.disabled = true));
    }
  }

  function init(){
    const email = localStorage.getItem('user');
    const role = localStorage.getItem('role');

    // If we're on public pages (login/create-account/logs) do not force redirect
    const page = window.location.pathname.split('/').pop();
    const publicPages = ['login.html', 'create-account.html', 'logs.html'];
    if(!email && publicPages.includes(page)){
      // do not redirect — allow login/create account pages to load
      return;
    }

    if(!email){
      window.location.href = 'login.html';
      return;
    }

    const welcome = document.getElementById('welcomeText');
    if(welcome) welcome.innerText = `Hello, ${email.split('@')[0]} (${role || 'teammate'}) 👋`;

    // show/hide panels based on role and permissions
    const adminPanel = document.getElementById('adminPanel');
    const organizerPanel = document.getElementById('organizerPanel');
    const touristGuidePanel = document.getElementById('touristGuidePanel');

    if(hasPermission(role, 'view_all_users') && adminPanel) {
      adminPanel.style.display = 'block';
    }
    if(hasPermission(role, 'add_teammate') && organizerPanel) {
      organizerPanel.style.display = 'block';
    }
    if(hasPermission(role, 'view_nearby_members') && touristGuidePanel) {
      touristGuidePanel.style.display = 'block';
    }

    // Teammate lockdown
    lockdownTeammate(email, role);

    // Admin: do not auto-render logs -- require clicking 'Show Logs' to load user & login activity
    // This avoids showing sensitive lists automatically. Admin panel will be visible, but logs load on demand.

    // Organizer: render teammates
    if(hasPermission(role, 'add_teammate')) {
      renderOrganizerTeammates();
    }

    // Tourist guide: render nearby members
    if(hasPermission(role, 'view_nearby_members')) {
      showNearbyMembers();
    }
  }

  // Password hashing using SubtleCrypto (returns hex)
  async function hashPassword(password){
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
    return hashHex;
  }

  // Register a new user (reads fields from create-account.html)
  async function registerUser(){
    const firstName = (document.getElementById('firstName') && document.getElementById('firstName').value.trim()) || '';
    const lastName = (document.getElementById('lastName') && document.getElementById('lastName').value.trim()) || '';
    const username = (document.getElementById('username') && document.getElementById('username').value.trim()) || '';
    const email = (document.getElementById('email') && document.getElementById('email').value.trim()) || '';
    const password = (document.getElementById('password') && document.getElementById('password').value) || '';
    const confirm = (document.getElementById('confirmPassword') && document.getElementById('confirmPassword').value) || '';
    const role = (document.getElementById('roleSelect') && document.getElementById('roleSelect').value) || 'teammate';

    if(!email || !password || !confirm){ alert('Please fill email and passwords'); return; }
    if(!email.includes('@')){ alert('Please enter a valid email'); return; }
    if(password.length < 6){ alert('Password should be at least 6 characters'); return; }
    if(password !== confirm){ alert('Passwords do not match'); return; }

    const users = getUsers();
    if(users.find(u=>u.email === email)){
      alert('An account with this email already exists');
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = {
      email,
      passwordHash,
      role,
      name: username || (firstName ? `${firstName} ${lastName}`.trim() : email.split('@')[0]),
      firstName,
      lastName,
      username,
      location: '',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      addedBy: null
    };
    users.push(user);
    saveUsers(users);
    alert('Account created successfully — please login');
    window.location.href = 'login.html';
  }

  // Login user by email/password
  async function loginUser(){
    const email = (document.getElementById('email') && document.getElementById('email').value.trim()) || '';
    const password = (document.getElementById('password') && document.getElementById('password').value) || '';
    if(!email || !password){ alert('Enter email and password'); return; }

    const users = getUsers();
    const user = users.find(u => u.email === email);
    if(!user || !user.passwordHash){ alert('Invalid mail id or password'); return; }
    const hash = await hashPassword(password);
    if(hash !== user.passwordHash){ alert('Invalid mail id or password'); return; }

    // success
    user.lastLogin = new Date().toISOString();
    saveUsers(users);
    localStorage.setItem('user', user.email);
    localStorage.setItem('role', user.role);
    localStorage.setItem('loginTime', new Date().toISOString());
    window.location.href = 'index.html';
  }

  function refreshUsers(){
    const container = document.getElementById('nearbyMembers');
    if(!container) return;

    // For tourist-guide, show ONLY organizers (email, last login, location). Do not display teammates or other roles here.
    const users = getUsers();
    const organizers = users.filter(u => u.role === 'organizer');

    if(organizers.length === 0){
      container.innerHTML = '<p style="color:#666;">No organizers found in the system.</p>';
      return;
    }

    let html = '<div style="margin-bottom:8px;"><h4>Organizers</h4></div>';
    html += '<ul style="list-style:none;padding:0;margin:0;">';
    organizers.forEach(o => {
      const lastLogin = o.lastLogin ? new Date(o.lastLogin).toLocaleString() : 'Never logged in';
      // Prefer organizer's saved trip hotel if present (tripDetails_<email>), otherwise fall back to profile location
      let loc = o.location || '';
      try{
        const tripJson = localStorage.getItem(`tripDetails_${o.email}`);
        if(tripJson){
          const trip = JSON.parse(tripJson);
          if(trip && trip.hotel) loc = trip.hotel;
        }
      }catch(e){ /* ignore parse errors */ }
      if(!loc) loc = 'Location not provided';
      html += `<li style="padding:10px;background:#f9f9f9;margin:6px 0;border-radius:6px;border-left:4px solid #2b7cff;">
        <div style="font-weight:600">${o.email}</div>
        <div style="color:#666;font-size:13px">Last Login: ${lastLogin}</div>
        <div style="color:#666;font-size:13px">Location: ${loc}</div>
      </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
  }

  function refreshLoginActivity(){
    const container = document.getElementById('loginActivityContainer');
    if(!container) return;
    
    const users = getUsers();
    const logins = users.filter(u => u.lastLogin).sort((a,b) => 
      new Date(b.lastLogin) - new Date(a.lastLogin)
    ).slice(0, 20);

    if(logins.length === 0) {
      container.innerHTML = '<p>No login activity yet.</p>';
      return;
    }

    let html = '<table style="width:100%;border-collapse:collapse;">';
    html += '<tr style="background:#f0f0f0;"><th style="text-align:left;padding:8px;border:1px solid #ddd;">User</th><th style="padding:8px;border:1px solid #ddd;">Role</th><th style="padding:8px;border:1px solid #ddd;">Last Login</th></tr>';
    logins.forEach(u => {
      const lastLoginDate = new Date(u.lastLogin).toLocaleString();
      html += `<tr style="border:1px solid #ddd;"><td style="padding:8px;">${u.email}</td><td style="padding:8px;">${u.role}</td><td style="padding:8px;">${lastLoginDate}</td></tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
  }

  function addTeammate(){
    const role = localStorage.getItem('role');
    
    // Permission check: Teammates cannot add teammates
    if(!hasPermission(role, 'add_teammate')) {
      alert('You do not have permission to add teammates. Only organizers can add teammates.');
      return;
    }

    const emailInput = document.getElementById('newTeammateEmail');
    const locInput = document.getElementById('newTeammateLocation');
    const email = emailInput && emailInput.value.trim();
    const loc = locInput && locInput.value.trim();
    
    if(!email){ 
      alert('Enter teammate email'); 
      return; 
    }

    if(!email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    const users = getUsers();
    if(users.find(u=>u.email===email)){
      alert('User already exists in the system');
      return;
    }

    const current = localStorage.getItem('user');
    users.push({ 
      email, 
      role: 'teammate', 
      name: email.split('@')[0], 
      location: loc || '', 
      addedBy: current,
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
    emailInput.value = '';
    if(locInput) locInput.value = '';
    renderOrganizerTeammates();
    alert('✓ Teammate added successfully');
  }

  function renderOrganizerTeammates(){
    const list = document.getElementById('organizerTeammatesList');
    if(!list) return;
    
    const current = localStorage.getItem('user');
    const users = getUsers();
    const organizedTeammates = users.filter(u => u.addedBy === current);
    
    if(organizedTeammates.length === 0){
      list.innerHTML = '<p>No teammates added yet. Add teammates above to form your travel group.</p>';
      return;
    }

    let html = '<div style="margin-top:15px;"><h4>Your Teammates (' + organizedTeammates.length + ')</h4><ul style="list-style:none;padding:0;">';
    organizedTeammates.forEach(u => {
      html += `<li style="padding:8px;border:1px solid #ddd;margin:5px 0;border-radius:4px;">📍 ${u.email} ${u.location?'<strong>(' + u.location + ')</strong>':''}</li>`;
    });
    html += '</ul></div>';
    list.innerHTML = html;
  }

  function showNearbyMembers(){
    const container = document.getElementById('nearbyMembers');
    if(!container) return;

    // For tourist guides: show only organizers (email, last login, location)
    const users = getUsers();
    const organizers = users.filter(u => u.role === 'organizer');

    if(organizers.length === 0){
      container.innerHTML = '<p style="color:#666;">No organizers found in the system.</p>';
      return;
    }

    let html = '<div style="margin-bottom:8px;"><h4>Organizers</h4></div>';
    html += '<ul style="list-style:none;padding:0;margin:0;">';
    organizers.forEach(o => {
      const lastLogin = o.lastLogin ? new Date(o.lastLogin).toLocaleString() : 'Never logged in';
      const loc = o.location || 'Location not provided';
      html += `<li style="padding:10px;background:#f9f9f9;margin:6px 0;border-radius:6px;border-left:4px solid #2b7cff;">
        <div style="font-weight:600">${o.email}</div>
        <div style="color:#666;font-size:13px">Last Login: ${lastLogin}</div>
        <div style="color:#666;font-size:13px">Location: ${loc}</div>
      </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
  }

  // Allow admin removal of users from admin panel (keeps parity with logs page remove). This is safe and used by some UI flows.
  function removeUser(email){
    const currentAdmin = localStorage.getItem('user');
    if(!confirm(`Are you sure you want to remove user ${email}? This cannot be undone.`)) return;
    if(email === currentAdmin){
      alert('You cannot remove your own admin account while logged in.');
      return;
    }
    let users = getUsers();
    users = users.filter(u => u.email !== email);
    saveUsers(users);
    // re-render lists if visible
    const listEl = document.getElementById('allUsersList');
    const actEl = document.getElementById('loginActivityContainer');
    if(listEl && listEl.style.display !== 'none') refreshUsers();
    if(actEl && actEl.style.display !== 'none') refreshLoginActivity();
    alert('User removed successfully');
  }

  // Show logs on demand (users + login activity). This is intentionally not auto-called on init.
  function showLogs(){
    // Open logs in a new tab so admin actions are performed in a separate page.
    window.open('logs.html', '_blank');
  }

  // expose functions for buttons
  window.refreshUsers = refreshUsers;
  window.refreshLoginActivity = refreshLoginActivity;
  window.addTeammate = addTeammate;
  window.renderOrganizerTeammates = renderOrganizerTeammates;
  window.showNearbyMembers = showNearbyMembers;
  window.showLogs = showLogs;
  window.removeUser = removeUser;
  window.registerUser = registerUser;
  window.loginUser = loginUser;
  window.hasPermission = hasPermission;  // expose for checking permissions in other scripts

  // initialize when DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
