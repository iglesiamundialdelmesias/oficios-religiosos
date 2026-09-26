/* ============================================================
   Sorei Saishi — Integración con Supabase
   Este archivo carga app.js (lógica base) y luego sobrescribe
   las funciones que necesitan hablar con Supabase.
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const configured = Boolean(
  window.SUPABASE_URL &&
  window.SUPABASE_ANON_KEY &&
  !String(window.SUPABASE_URL).includes('TU-PROYECTO') &&
  !String(window.SUPABASE_ANON_KEY).includes('TU_ANON') &&
  !String(window.SUPABASE_ANON_KEY).includes('TU_PUBLISHABLE')
);

/* ------------------------------------------------------------
   MODO LOCAL (sin Supabase configurado)
   ------------------------------------------------------------ */
if (!configured) {
  const s = document.createElement('script');
  s.src = './app.js';
  document.head.appendChild(s);
  document.addEventListener('DOMContentLoaded', () => {
    const lb = document.getElementById('supabaseLoginBtn');
    const sb = document.getElementById('supabaseSignupBtn');
    if (lb) lb.onclick = () => alert('Configura supabase-config.js para conectar a Supabase.');
    if (sb) sb.onclick = () => alert('Configura supabase-config.js para registrar usuarios.');
  });
}
/* ------------------------------------------------------------
   MODO SUPABASE
   ------------------------------------------------------------ */
else {
  const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  window.__supabase = supabase;

  // Cargar app.js primero, luego enganchar
  const appScript = document.createElement('script');
  appScript.src = './app.js';
  appScript.onload = () => wireAuth();
  document.head.appendChild(appScript);

  /* ---------- AUTENTICACIÓN ---------- */
  async function wireAuth() {
    const loginBtn = document.getElementById('supabaseLoginBtn');
    const signupBtn = document.getElementById('supabaseSignupBtn');

    loginBtn.onclick = async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (!email || !password) return window.toast('Completa correo y contraseña', 'error');

      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span class="spinner"></span> Ingresando…';

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      loginBtn.disabled = false;
      loginBtn.textContent = 'Ingresar';

      if (error) return window.toast(error.message, 'error');
      await openApp();
    };

    signupBtn.onclick = async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (!email || password.length < 6)
        return window.toast('Ingresa correo y una contraseña de al menos 6 caracteres.', 'error');

      const name = prompt('Nombre completo:') || email.split('@')[0];
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      });
      if (error) return window.toast(error.message, 'error');
      window.toast('Cuenta creada. Revisa tu correo si se exige confirmación.');
    };

    const { data } = await supabase.auth.getSession();
    if (data.session) await openApp();
  }

  /* ---------- ABRIR APP ---------- */
  async function openApp() {
    const profile = await hydrate();
    if (!profile) return;
    window.currentProfile = profile;
    window.showApp();
  }

  /* ---------- HYDRATE: cargar datos desde Supabase ---------- */
  async function hydrate() {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return null;

    const user = auth.user;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, departments(*)')
      .eq('id', user.id)
      .single();

    if (error) { window.toast(error.message, 'error'); return null; }

    const state = window.getSoreiState();
    state.user = {
      name: profile.full_name,
      role: profile.role === 'ADMIN_GENERAL' ? 'admin' : 'responsable',
      dept: profile.departments?.name || 'Sin departamento'
    };
    state.dept = {
      name: profile.departments?.name || 'Sin departamento',
      responsible: profile.departments?.responsible_user_id === user.id ? profile.full_name : '',
      phone: profile.departments?.phone || '',
      hours: profile.departments?.hours || ''
    };

    const [anc, req, notif, svc] = await Promise.all([
      supabase.from('ancestors').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('requests').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('services').select('*').order('service_date').limit(60)
    ]);

    state.ancestors = (anc.data || []).map(a => ({
      ...a,
      family: a.family_name, spirit: a.spirit_name, death: a.death_date,
      age: a.age_at_death, sex: a.sex, status: a.membership_status,
      relation: a.relationship, lineage: a.lineage_type,
      applicant: a.applicant_user_id, code: a.applicant_code,
      department: state.dept.name
    }));

    state.requests = (req.data || []).map(r => ({
      ...r,
      spirit: r.spirit || '',
      family: r.family || '',
      month: r.requested_month,
      created: r.created_at?.slice(0, 10),
      status: r.status === 'REVISION' ? 'Revisión'
            : r.status === 'APROBADO' ? 'Aprobado'
            : r.status === 'RECHAZADO' ? 'Rechazado'
            : 'Pendiente',
      department: state.dept.name
    }));

    state.notifications = (notif.data || []).map(n => ({
      ...n, text: n.body, level: n.level,
      date: n.created_at?.slice(0, 10), read: Boolean(n.read_at)
    }));

    state.services = svc.data || [];

    return profile;
  }
  window.hydrateFromSupabase = hydrate;

  /* ---------- INSERT genérico ---------- */
  async function insert(table, payload) {
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) { window.toast(error.message, 'error'); return null; }
    return data;
  }

  /* ---------- LOGOUT ---------- */
  window.supabaseSignOut = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  /* ---------- GUARDAR ANTEPASADO ---------- */
  window.saveAncestor = async function () {
    const state = window.getSoreiState();
    const val = id => document.getElementById('f_' + id)?.value || '';
    const profile = window.currentProfile;
    const { data: auth } = await supabase.auth.getUser();

    const payload = {
      department_id: profile.department_id,
      family_name: val('family'),
      spirit_name: val('spirit'),
      death_date: val('death'),
      age_at_death: Number(val('age') || 0),
      sex: val('sex'),
      membership_status: val('status'),
      relationship: val('relation'),
      lineage_type: (val('lineage') || '').toUpperCase() || null,
      applicant_user_id: auth.user.id,
      applicant_code: val('code'),
      notes: val('obs')
    };

    if (!payload.spirit_name || !payload.death_date)
      return window.toast('Completa nombre y fecha de fallecimiento', 'error');

    const row = await insert('ancestors', payload);
    if (!row) return;

    state.ancestors.unshift({
      ...row,
      family: row.family_name, spirit: row.spirit_name,
      death: row.death_date, age: row.age_at_death, sex: row.sex,
      status: row.membership_status, relation: row.relationship,
      lineage: row.lineage_type, department: state.dept.name
    });

    window.closeModal();
    window.refresh();
    window.toast('Antepasado registrado');
  };

  /* ---------- GUARDAR SOLICITUD ---------- */
  window.saveRequest = async function () {
    const state = window.getSoreiState();
    const val = id => document.getElementById('f_' + id)?.value || '';
    const profile = window.currentProfile;
    const { data: auth } = await supabase.auth.getUser();

    const type = val('type');
    const death = val('death');

    if (!val('spirit')) return window.toast('Completa el nombre del espíritu o linaje', 'error');

    if (type === 'Shinrei Saishi' && death) {
      const days = Math.floor((Date.now() - new Date(death + 'T00:00:00').getTime()) / 86400000);
      if (days > 50) return window.toast('Shinrei Saishi debe solicitarse antes de 50 días.', 'error');
    }

    if ((type === 'Nensai' || type === 'Ireisai') && !val('month'))
      return window.toast('Selecciona el mes solicitado.', 'error');

    const row = await insert('requests', {
      department_id: profile.department_id,
      type,
      requested_month: val('month') ? val('month') + '-01' : null,
      notes: `${val('spirit')} | Familia: ${val('family')} | Fallecimiento: ${death} | Relación: ${val('relation')} | Código: ${val('code')} | ${val('notes')}`,
      created_by: auth.user.id
    });

    if (!row) return;

    state.requests.unshift({
      ...row,
      spirit: val('spirit'),
      family: val('family'),
      month: row.requested_month,
      created: row.created_at.slice(0, 10),
      status: 'Pendiente',
      department: state.dept.name
    });

    window.closeModal();
    window.refresh();
    window.toast('Solicitud registrada');
  };

  /* ---------- GUARDAR DEPARTAMENTO ---------- */
  window.saveDepartment = async function () {
    const profile = window.currentProfile;
    if (!profile?.department_id)
      return window.toast('Tu usuario no tiene un Departamento de iglesia asignado.', 'error');

    const payload = {
      name: document.getElementById('deptName').value,
      phone: document.getElementById('deptPhone').value,
      hours: document.getElementById('deptHours').value
    };

    const { error } = await supabase
      .from('departments')
      .update(payload)
      .eq('id', profile.department_id);

    if (error) return window.toast(error.message, 'error');
    await hydrate();
    window.refresh();
    window.toast('Departamento actualizado');
  };

  /* ---------- NOTIFICACIONES ---------- */
  window.markNotificationsRead = async function () {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', auth.user.id)
      .is('read_at', null);

    if (error) return window.toast(error.message, 'error');
    await hydrate();
    window.refresh();
  };

  /* ============================================================
     USUARIOS — vía Edge Function (admin-users)
     ============================================================ */
  async function callAdminUsers(payload) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.toast('Sesión expirada', 'error'); return null; }

    const url = `${window.SUPABASE_URL}/functions/v1/admin-users`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': window.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      window.toast(data.error || 'Error en la operación', 'error');
      return null;
    }
    return data;
  }

  async function loadUsersFromSupabase() {
    const data = await callAdminUsers({ action: 'list' });
    if (!data) return [];
    return (data.users || []).map(u => ({
      id: u.id,
      full_name: u.full_name,
      name: u.full_name,
      email: u.email,
      role: u.role,
      department_id: u.department_id,
      departamento: u.departamento,
      dept: u.departamento,
      active: u.active,
    }));
  }

  const origRenderUsers = window.renderUsers;
  window.renderUsers = async function () {
    const cont = document.getElementById("userList");
    if (!cont) return;
    cont.innerHTML = `<div class="skeleton"></div><div class="skeleton" style="margin-top:10px"></div>`;

    const users = await loadUsersFromSupabase();
    window.getSoreiState().users = users;
    origRenderUsers();
  };

  window.saveUser = async function (id) {
    const name = document.getElementById("f_uname")?.value?.trim() || "";
    const email = document.getElementById("f_uemail")?.value?.trim() || "";
    const password = document.getElementById("f_upassword")?.value || "";
    const role = document.getElementById("f_urole")?.value || "RESPONSABLE_IGLESIA";
    const active = document.getElementById("f_uactive")?.value === "true";
    const deptName = document.getElementById("f_udept")?.value?.trim() || "";

    if (!name) return window.toast("Completa el nombre", "error");

    let department_id = null;
    if (deptName) {
      const { data: dept } = await supabase
        .from('departments').select('id').eq('name', deptName).maybeSingle();
      department_id = dept?.id || null;
    }

    let result;
    if (id) {
      result = await callAdminUsers({
        action: 'update', user_id: id,
        full_name: name, role, active, department_id,
        password: password || undefined,
      });
    } else {
      if (!email) return window.toast("Completa el correo", "error");
      if (!password || password.length < 6)
        return window.toast("La contraseña debe tener al menos 6 caracteres", "error");
      result = await callAdminUsers({
        action: 'create', email, password,
        full_name: name, role, department_id,
      });
    }

    if (!result) return;
    window.toast(id ? 'Usuario actualizado' : 'Usuario creado');
    window.closeModal();
    window.renderUsers();
  };

  window.deleteUser = async function (id) {
    if (!confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) return;
    const result = await callAdminUsers({ action: 'delete', user_id: id });
    if (!result) return;
    window.toast('Usuario eliminado');
    window.renderUsers();
  };

  window.editUser = function (id) {
    const u = (window.getSoreiState().users || []).find(x => x.id === id);
    if (!u) return window.toast("Usuario no encontrado", 'error');
    document.getElementById("modalContent").innerHTML = window.userForm(u);
    document.getElementById("modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };

  /* ---------- REGISTRAR SERVICE WORKER ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}