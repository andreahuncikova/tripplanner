async function authRegister(form) {
  const data = { username: form.username.value, email: form.email.value, password: form.password.value };
  const r = await api('/api/auth/register', 'POST', data);
  if (r.error) return setAuthErr(r.error);
  storeAuth(r);
  afterAuthRedirect();
}

async function authLogin(form) {
  const data = { email: form.email.value, password: form.password.value };
  const r = await api('/api/auth/login', 'POST', data);
  if (r.error) return setAuthErr(r.error);
  storeAuth(r);
  afterAuthRedirect();
}

// after login/register, check if there's a pending invite code
function afterAuthRedirect() {
  showDash();
  const pending = localStorage.getItem('tp_pending_code');
  if (pending) {
    localStorage.removeItem('tp_pending_code');
    document.getElementById('join-code-input').value = pending;
    showJoinModal();
  }
}

async function logout() {
  await api('/api/auth/logout', 'POST');
  token = null; me = null;
  localStorage.removeItem('tp_token');
  localStorage.removeItem('tp_me');
  if (socket) { socket.disconnect(); socket = null; }
  showScreen('auth');
}

function storeAuth(r) {
  token = r.token; me = r.user;
  localStorage.setItem('tp_token', token);
  localStorage.setItem('tp_me', JSON.stringify(me));
}

function setAuthErr(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  setTimeout(() => el.textContent = '', 4000);
}
