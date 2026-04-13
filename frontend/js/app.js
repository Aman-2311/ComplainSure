// config

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '/api' 
  : 'https://complainsure-production.up.railway.app/api';
const STAGES = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'];

// session data
let currentUser  = JSON.parse(localStorage.getItem('cs_session')) || null;
let loginRole    = 'student';

// api helper function

async function apiCall(endpoint, method = 'GET', body = null) {
  const token = currentUser?.token;

  const options = {
    method,
    headers: {
      'Content-Type':  'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  };

  const res  = await fetch(API + endpoint, options);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// page navigation

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);

  if (id === 'pg-student') renderStudentDashboard();
  if (id === 'pg-submit')  prepSubmit();
  if (id === 'pg-admin')   renderAdminDashboard();
}

// restore session on page load
window.addEventListener('DOMContentLoaded', () => {
  if (currentUser) {
    if (currentUser.role === 'student') showPage('pg-student');
    else showPage('pg-admin');
  }
});

// auth functions

function switchLoginRole(role, el) {
  loginRole = role;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const lbl = document.getElementById('login-email-label');
  const inp = document.getElementById('login-email');

  // clear inputs on tab switch
  inp.value = '';
  document.getElementById('login-password').value = '';
  clearAlert(document.getElementById('login-alert'));

  const signupLink = document.querySelector('#pg-login .form-footer-link');

  if (role === 'admin') {
    lbl.textContent = 'Admin Username';
    inp.placeholder = 'admin@ghrcemp.raisoni.net';
    if (signupLink) signupLink.style.display = 'block';
  } else {
    lbl.textContent = 'College Email';
    inp.placeholder = 'yourname@ghrcemp.raisoni.net';
    if (signupLink) signupLink.style.display = 'block';
  }
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass  = document.getElementById('login-password').value;
  const box   = document.getElementById('login-alert');

  if (!email || !pass) { showAlert(box, 'danger', 'Please fill in all fields.'); return; }

  try {
    const endpoint = loginRole === 'student' ? '/auth/login/student' : '/auth/login/admin';
    const data = await apiCall(endpoint, 'POST', {
      email: loginRole === 'student' ? email : undefined,
      username: loginRole === 'admin' ? email : undefined,
      password: pass
    });

    // save session
    currentUser = { ...data.user, token: data.token };
    localStorage.setItem('cs_session', JSON.stringify(currentUser));

    clearAlert(box);
    if (data.user.role === 'student') showPage('pg-student');
    else showPage('pg-admin');

  } catch (err) {
    showAlert(box, 'danger', err.message);
  }
}

async function doSignup() {
  const name    = document.getElementById('su-name').value.trim();
  const email   = document.getElementById('su-email').value.trim().toLowerCase();
  const roll    = document.getElementById('su-roll').value.trim();
  const pass    = document.getElementById('su-pass').value;
  const confirm = document.getElementById('su-confirm').value;
  const box     = document.getElementById('signup-alert');

  document.getElementById('err-email').classList.remove('show');
  document.getElementById('err-pass').classList.remove('show');

  if (!name || !email || !roll || !pass || !confirm) {
    showAlert(box, 'danger', 'All fields are required.'); return;
  }
  if (!email.endsWith('@ghrcemp.raisoni.net')) {
    document.getElementById('err-email').classList.add('show');
    showAlert(box, 'danger', 'Please use your college email (@ghrcemp.raisoni.net).');
    return;
  }
  if (pass !== confirm) {
    document.getElementById('err-pass').classList.add('show');
    showAlert(box, 'danger', 'Passwords do not match.'); return;
  }
  if (pass.length < 6) {
    showAlert(box, 'danger', 'Password must be at least 6 characters.'); return;
  }

  try {
    const data = await apiCall('/auth/signup', 'POST', { name, email, roll, password: pass });
    showAlert(box, 'success', data.message + ' Redirecting to login...');
    setTimeout(() => { 
      clearAlert(box); 
      switchLoginRole('student', document.querySelectorAll('.role-tab')[0]);
      showPage('pg-login'); 
    }, 1500);
  } catch (err) {
    showAlert(box, 'danger', err.message);
  }
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('cs_session');
  showPage('pg-home');
}

// student dashboard

async function renderStudentDashboard() {
  if (!currentUser) return;
  document.getElementById('s-nav-name').textContent = currentUser.name;
  document.getElementById('s-anon-id').textContent  = currentUser.complainantId;

  const box = document.getElementById('s-complaint-list');
  box.innerHTML = '<p style="color:var(--muted);font-size:13px">Loading...</p>';

  try {
    const complaints = await apiCall('/complaint/mine');

    if (!complaints.length) {
      box.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📋</div>
          <h3>No complaints yet</h3>
          <p>Submit your first complaint and track it here.</p>
          <button class="btn btn-gold" onclick="showPage('pg-submit')">Submit a Complaint</button>
        </div>`;
      return;
    }

    box.innerHTML = `
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>Complaint ID</th><th>Category</th><th>Subject</th>
            <th>Status</th><th>Submitted On</th><th>Action</th>
          </tr></thead>
          <tbody>
            ${complaints.map(c => `<tr>
              <td class="mono">${c.complaint_id}</td>
              <td><span class="badge badge-cat">${c.category}</span></td>
              <td>${c.subject}</td>
              <td>${pillHtml(c.status)}</td>
              <td style="font-size:12px">${new Date(c.created_at).toLocaleString('en-IN')}</td>
              <td><button class="btn btn-navy btn-sm" onclick="openTrack('${c.complaint_id}')">Track</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    box.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function prepSubmit() {
  if (!currentUser) return;
  document.getElementById('s-nav-name2').textContent    = currentUser.name;
  document.getElementById('submit-anon-id').textContent = currentUser.complainantId;
}

async function doSubmit() {
  const category    = document.getElementById('c-cat').value;
  const subject     = document.getElementById('c-subject').value.trim();
  const description = document.getElementById('c-desc').value.trim();
  const box         = document.getElementById('submit-alert');

  if (!category || !subject || !description) {
    showAlert(box, 'danger', 'All fields are required.'); return;
  }

  try {
    const data = await apiCall('/complaint/submit', 'POST', { category, subject, description });

    document.getElementById('c-cat').value     = '';
    document.getElementById('c-subject').value = '';
    document.getElementById('c-desc').value    = '';

    showAlert(document.getElementById('student-alert'), 'success', `Complaint submitted! ID: ${data.complaintId}`);
    openTrack(data.complaintId);

  } catch (err) {
    showAlert(box, 'danger', err.message);
  }
}

async function openTrack(complaintId) {
  const box = document.getElementById('track-content');
  showPage('pg-track');
  box.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:2rem">Loading...</p>';

  try {
    const { complaint: c, history } = await apiCall(`/complaint/track/${complaintId}`);
    const currIdx = STAGES.indexOf(c.status);

    box.innerHTML = `
      <div class="track-hdr">
        <div>
          <h2>${c.complaint_id}</h2>
          <p>${c.category} — ${c.subject}</p>
        </div>
        <button class="btn btn-outline btn-sm" onclick="showPage('pg-student')">Back</button>
      </div>

      <div class="progress-bar">
        ${STAGES.map((s, i) => `
          <div class="step ${i < currIdx ? 'done' : ''} ${i === currIdx ? 'curr' : ''}">
            <div class="step-dot"></div>
            <div class="step-lbl">${s}</div>
          </div>
          ${i < STAGES.length - 1 ? `<div class="step-line ${i < currIdx ? 'filled' : ''}"></div>` : ''}
        `).join('')}
      </div>

      <div class="info-row">
        <div class="info-box"><div class="info-lbl">Status</div><div class="info-val">${pillHtml(c.status)}</div></div>
        <div class="info-box"><div class="info-lbl">Submitted On</div><div class="info-val" style="font-size:12px">${new Date(c.created_at).toLocaleString('en-IN')}</div></div>
        <div class="info-box"><div class="info-lbl">Last Updated</div><div class="info-val" style="font-size:12px">${new Date(c.updated_at).toLocaleString('en-IN')}</div></div>
        <div class="info-box"><div class="info-lbl">Expected Resolution</div><div class="info-val">${c.eta || 'Not set yet'}</div></div>
      </div>

      <div class="sec-box">
        <h4>Description</h4>
        <p>${c.description}</p>
      </div>

      <div class="sec-box">
        <h4>Status Timeline</h4>
        <div class="timeline">
          ${history.map(h => `
            <div class="tl-item">
              <div class="tl-dot"></div>
              <div>
                ${pillHtml(h.status)}
                <div class="tl-remark">${h.remark}</div>
                <div class="tl-meta">${new Date(h.changed_at).toLocaleString('en-IN')} — ${h.changed_by}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;

  } catch (err) {
    box.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

// admin dashboard

async function renderAdminDashboard() {
  if (!currentUser) return;
  document.getElementById('a-nav-name').textContent = currentUser.displayName || currentUser.username;
  document.getElementById('a-role-label').innerHTML = currentUser.role === 'head_admin'
    ? `Logged in as: <strong>${currentUser.username}</strong> <span class="badge badge-head">Head Admin</span>`
    : `Logged in as: <strong>${currentUser.username}</strong>`;

  renderAdminList();
}

async function renderAdminList() {
  const status   = document.getElementById('f-status').value;
  const category = document.getElementById('f-cat').value;

  let endpoint = '/admin/complaints?';
  if (status)   endpoint += `status=${status}&`;
  if (category) endpoint += `category=${category}`;

  const box = document.getElementById('a-complaint-list');
  box.innerHTML = '<p style="color:var(--muted);font-size:13px">Loading...</p>';

  try {
    const { complaints, counts } = await apiCall(endpoint);

    // status count cards
    const allStatuses = ['Submitted','Under Review','In Progress','Resolved','Closed'];
    document.getElementById('a-counts').innerHTML = allStatuses.map(s => {
      const found = counts.find(c => c.status === s);
      return `<div class="count-card">
        <div class="count-num">${found ? found.count : 0}</div>
        <div class="count-label">${s}</div>
      </div>`;
    }).join('');

    if (!complaints.length) {
      box.innerHTML = `<div class="empty"><p>No complaints found for selected filters.</p></div>`;
      return;
    }

    box.innerHTML = `
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>Complaint ID</th><th>Complainant ID</th><th>Category</th>
            <th>Subject</th><th>Status</th><th>Submitted</th><th>Action</th>
          </tr></thead>
          <tbody>
            ${complaints.map(c => `<tr>
              <td class="mono">${c.complaint_id}</td>
              <td class="mono">${c.complainant_id}</td>
              <td><span class="badge badge-cat">${c.category}</span></td>
              <td>${c.subject}</td>
              <td>${pillHtml(c.status)}</td>
              <td style="font-size:12px">${new Date(c.created_at).toLocaleString('en-IN')}</td>
              <td><button class="btn btn-navy btn-sm" onclick="openDetail('${c.complaint_id}')">View</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    box.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

async function openDetail(complaintId) {
  showPage('pg-detail');
  const box = document.getElementById('detail-content');
  box.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:2rem">Loading...</p>';

  try {
    const { complaint: c, history, identity } = await apiCall(`/admin/complaint/${complaintId}`);

    const identityHtml = identity
      ? `<div class="identity-box">
          <span class="badge badge-head">Head Admin View</span>
          <p><strong>Student Name:</strong> ${identity.name}</p>
          <p><strong>Email:</strong> ${identity.email}</p>
          <p class="identity-note">This access has been logged.</p>
         </div>`
      : `<div class="sec-box"><p><strong>Complainant ID:</strong> <span class="mono">${c.complainant_id}</span></p></div>`;

    box.innerHTML = `
      <div class="track-hdr">
        <div><h2>${c.complaint_id}</h2><p>${c.category} — ${c.subject}</p></div>
        <button class="btn btn-outline btn-sm" onclick="showPage('pg-admin')">Back</button>
      </div>

      ${identityHtml}

      <div class="sec-box">
        <h4>Description</h4>
        <p>${c.description}</p>
        <p style="margin-top:10px;font-size:12px;color:var(--muted)">
          Submitted: ${new Date(c.created_at).toLocaleString('en-IN')} |
          Updated: ${new Date(c.updated_at).toLocaleString('en-IN')}
        </p>
        ${c.eta ? `<p style="margin-top:6px;font-size:13px"><strong>Expected Resolution:</strong> ${c.eta}</p>` : ''}
      </div>

      <div class="sec-box">
        <h4>Update Status</h4>
        <div class="form-row">
          <div class="field">
            <label>New Status</label>
            <select id="d-status">
              ${STAGES.map(s => `<option ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Expected Resolution</label>
            <input type="text" id="d-eta" placeholder="e.g. 5 working days" value="${c.eta || ''}"/>
          </div>
        </div>
        <div class="field">
          <label>Remark</label>
          <textarea id="d-remark" rows="3" placeholder="Add a note visible to the student..."></textarea>
        </div>
        <div id="detail-alert"></div>
        <button class="btn btn-navy" onclick="updateStatus('${c.complaint_id}')">Update Status</button>
      </div>

      <div class="sec-box">
        <h4>Status Timeline</h4>
        <div class="timeline">
          ${history.map(h => `
            <div class="tl-item">
              <div class="tl-dot"></div>
              <div>
                ${pillHtml(h.status)}
                <div class="tl-remark">${h.remark}</div>
                <div class="tl-meta">${new Date(h.changed_at).toLocaleString('en-IN')} — ${h.changed_by}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;

  } catch (err) {
    box.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

async function updateStatus(complaintId) {
  const status = document.getElementById('d-status').value;
  const remark = document.getElementById('d-remark').value.trim();
  const eta    = document.getElementById('d-eta').value.trim();
  const box    = document.getElementById('detail-alert');

  if (!remark) { showAlert(box, 'danger', 'Please add a remark before updating.'); return; }

  try {
    const data = await apiCall(`/admin/complaint/${complaintId}/update`, 'POST', { status, remark, eta });
    showAlert(box, 'success', data.message);
    setTimeout(() => openDetail(complaintId), 1000);
  } catch (err) {
    showAlert(box, 'danger', err.message);
  }
}

// helper functions

function pillHtml(status) {
  const cls = 'pill-' + status.toLowerCase().replace(/ /g, '-');
  return `<span class="pill ${cls}">${status}</span>`;
}

function showAlert(box, type, msg) {
  box.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

function clearAlert(box) { box.innerHTML = ''; }
