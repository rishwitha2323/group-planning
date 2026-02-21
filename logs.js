// logs.js — render users & login activity in a separate tab
(function(){
  function getUsers(){
    return JSON.parse(localStorage.getItem('users') || '[]');
  }

  function saveUsers(users){
    localStorage.setItem('users', JSON.stringify(users));
  }

  function renderUsers(){
    const container = document.getElementById('usersContainer');
    const users = getUsers();
    const current = localStorage.getItem('user');
    if(!container) return;
    if(users.length === 0){
      container.innerHTML = '<p>No users found.</p>';
      return;
    }

    let html = '<table>';
    html += '<tr><th>Email</th><th>Role</th><th>Location</th><th>Added By</th><th>Created</th><th>Actions</th></tr>';
    users.forEach(u => {
      const created = u.createdAt ? new Date(u.createdAt).toLocaleString() : 'N/A';
      const disableRemove = (u.email === current);
      const removeBtn = disableRemove ? '<button disabled style="opacity:0.5;padding:6px 8px;">Remove</button>' : `<button data-email="${u.email}" class="removeBtn" style="background:#e74c3c;color:white;border:none;padding:6px 8px;border-radius:4px;">Remove</button>`;
      html += `<tr><td>${u.email}</td><td>${u.role}</td><td>${u.location||''}</td><td>${u.addedBy||'Self'}</td><td>${created}</td><td>${removeBtn}</td></tr>`;
    });
    html += '</table>';
    container.innerHTML = html;

    document.querySelectorAll('.removeBtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const email = e.currentTarget.getAttribute('data-email');
        removeUser(email);
      });
    });
  }

  function renderActivity(){
    const container = document.getElementById('activityContainer');
    const users = getUsers();
    if(!container) return;

    const logins = users.filter(u=>u.lastLogin).sort((a,b)=> new Date(b.lastLogin)-new Date(a.lastLogin)).slice(0,50);
    if(logins.length === 0){
      container.innerHTML = '<p>No login activity yet.</p>';
      return;
    }

    let html = '<table>';
    html += '<tr><th>User</th><th>Role</th><th>Last Login</th></tr>';
    logins.forEach(u=>{
      html += `<tr><td>${u.email}</td><td>${u.role}</td><td>${new Date(u.lastLogin).toLocaleString()}</td></tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
  }

  function removeUser(email){
    const current = localStorage.getItem('user');
    if(email === current){
      alert('You cannot remove the account you are currently logged in with.');
      return;
    }
    if(!confirm(`Are you sure you want to remove ${email}?`)) return;
    let users = getUsers();
    users = users.filter(u=>u.email !== email);
    saveUsers(users);
    renderUsers();
    renderActivity();
    alert('User removed');
  }

  document.getElementById('refreshUsersBtn').addEventListener('click', renderUsers);
  document.getElementById('refreshActivityBtn').addEventListener('click', renderActivity);

  // initial render
  renderUsers();
  renderActivity();

})();
