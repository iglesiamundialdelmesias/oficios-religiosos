import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const configured = Boolean(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && !String(window.SUPABASE_URL).includes('TU-PROYECTO') && !String(window.SUPABASE_ANON_KEY).includes('TU_ANON'));
const supabase = configured ? createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;

const appScript = document.createElement('script');
appScript.src = './app.js';
appScript.onload = () => {
  if (!configured) {
    document.getElementById('supabaseLoginBtn').onclick = () => alert('Configura supabase-config.js para conectar este sitio a Supabase.');
    document.getElementById('supabaseSignupBtn').onclick = () => alert('Configura supabase-config.js para registrar usuarios en Supabase.');
    return;
  }
  wireAuth();
};
document.head.appendChild(appScript);

async function wireAuth() {
  const loginBtn = document.getElementById('supabaseLoginBtn');
  const signupBtn = document.getElementById('supabaseSignupBtn');
  loginBtn.onclick = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) return alert('Completa correo y contraseña.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
    await openApp();
  };
  signupBtn.onclick = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || password.length < 6) return alert('Ingresa correo y una contraseña de al menos 6 caracteres.');
    const name = prompt('Nombre completo:') || email.split('@')[0];
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) return alert(error.message);
    alert('Cuenta creada. Si tu proyecto exige confirmación de correo, revisa tu email antes de ingresar.');
  };
  const { data } = await supabase.auth.getSession();
  if (data.session) await openApp();
}

async function openApp() {
  const profile = await hydrate();
  window.currentProfile = profile;
  if (!profile) return;
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  window.applyRole?.();
  window.refresh?.();
}

async function hydrate() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return null;
  const user = auth.user;
  const { data: profile, error } = await supabase
    .from('profiles').select('*, departments(*)').eq('id', user.id).single();
  if (error) { alert(error.message); return null; }

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

  const [{data: ancestors}, {data: requests}, {data: notifications}, {data: services}] = await Promise.all([
    supabase.from('ancestors').select('*').order('created_at', {ascending:false}),
    supabase.from('requests').select('*').order('created_at', {ascending:false}),
    supabase.from('notifications').select('*').order('created_at', {ascending:false}),
    supabase.from('services').select('*').order('service_date')
  ]);
  state.ancestors = (ancestors || []).map(a => ({...a, family:a.family_name, spirit:a.spirit_name, death:a.death_date, age:a.age_at_death, sex:a.sex, status:a.membership_status, relation:a.relationship, applicant:a.applicant_user_id, code:a.applicant_code, department:state.dept.name}));
  state.requests = (requests || []).map(r => ({...r, spirit:r.spirit || '', family:r.family || '', month:r.requested_month, created:r.created_at?.slice(0,10), status:r.status === 'REVISION' ? 'Revisión' : r.status === 'APROBADO' ? 'Aprobado' : r.status === 'RECHAZADO' ? 'Rechazado' : 'Pendiente', department:state.dept.name}));
  state.notifications = (notifications || []).map(n => ({...n, text:n.body, level:n.level, date:n.created_at?.slice(0,10), read:Boolean(n.read_at)}));
  state.services = services || [];
  return profile;
}

async function insert(table, payload) {
  const {data, error} = await supabase.from(table).insert(payload).select().single();
  if (error) { alert(error.message); return null; }
  return data;
}

window.login = () => document.getElementById('supabaseLoginBtn').click();
window.logout = async () => { await supabase.auth.signOut(); location.reload(); };

const originalSaveAncestor = window.saveAncestor;
window.saveAncestor = async function() {
  const state = window.getSoreiState();
  const val = id => document.getElementById('f_'+id)?.value || '';
  const profile = window.currentProfile;
  const { data: auth } = await supabase.auth.getUser();
  const payload = {
    department_id: profile.department_id,
    family_name: val('family'), spirit_name: val('spirit'), death_date: val('death'),
    age_at_death: Number(val('age') || 0), sex: val('sex'), membership_status: val('status'),
    relationship: val('relation'), applicant_user_id: auth.user.id, applicant_code: val('code'), notes: val('obs')
  };
  if (!payload.spirit_name || !payload.death_date) return alert('Completa nombre y fecha de fallecimiento.');
  const row = await insert('ancestors', payload); if (!row) return;
  state.ancestors.unshift({...row, family:row.family_name, spirit:row.spirit_name, death:row.death_date, age:row.age_at_death, sex:row.sex, status:row.membership_status, relation:row.relationship, department:state.dept.name});
  closeModal(); refresh(); alert('Antepasado registrado en Supabase.');
};

const originalSaveRequest = window.saveRequest;
window.saveRequest = async function() {
  const state = window.getSoreiState();
  const val = id => document.getElementById('f_'+id)?.value || '';
  const profile = window.currentProfile;
  const { data: auth } = await supabase.auth.getUser();
  const type = val('type');
  const death = val('death');
  if (!val('spirit')) return alert('Completa el nombre del espíritu o linaje.');
  if (type === 'Shinrei Saishi' && death) {
    const days = Math.floor((Date.now() - new Date(death+'T00:00:00').getTime()) / 86400000);
    if (days > 50) return alert('Shinrei Saishi debe solicitarse antes de completar 50 días.');
  }
  const row = await insert('requests', {
    department_id: profile.department_id, type, requested_month: val('month') ? val('month')+'-01' : null,
    notes: `${val('spirit')} | Familia: ${val('family')} | Fallecimiento: ${death} | Relación: ${val('relation')} | Código: ${val('code')} | ${val('notes')}`,
    created_by: auth.user.id
  });
  if (!row) return;
  state.requests.unshift({...row, spirit:val('spirit'), family:val('family'), month:row.requested_month, created:row.created_at.slice(0,10), status:'Pendiente', department:state.dept.name});
  closeModal(); refresh(); alert('Solicitud registrada en Supabase.');
};

window.saveDepartment = async function() {
  const profile = window.currentProfile;
  if (!profile?.department_id) return alert('Tu usuario aún no tiene un Departamento de iglesia asignado. El Administrador general debe asignarlo.');
  const payload = {name:document.getElementById('deptName').value, phone:document.getElementById('deptPhone').value, hours:document.getElementById('deptHours').value};
  const {error} = await supabase.from('departments').update(payload).eq('id', profile.department_id);
  if (error) return alert(error.message);
  await hydrate(); refresh(); alert('Departamento actualizado.');
};

window.markNotificationsRead = async function() {
  const {data: auth} = await supabase.auth.getUser();
  const {error} = await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id', auth.user.id).is('read_at', null);
  if (error) return alert(error.message);
  await hydrate(); refresh();
};

async function generateCultoNotifications() {
  const {data: auth} = await supabase.auth.getUser();
  if (!auth.user) return;
  const {data: services} = await supabase.from('services').select('*').gte('service_date', new Date().toISOString().slice(0,10)).order('service_date').limit(10);
  if (!services?.length) return;
  const today = new Date();
  for (const s of services) {
    const dt = new Date(s.service_date+'T'+s.service_time);
    const days = Math.ceil((dt-today)/86400000);
    if (days >= 0 && days <= 7) {
      const title = `Próximo culto: ${s.type}`;
      const {data: exists} = await supabase.from('notifications').select('id').eq('user_id',auth.user.id).eq('title',title).gte('created_at',new Date().toISOString().slice(0,10)).limit(1);
      if (!exists?.length) await supabase.from('notifications').insert({user_id:auth.user.id,type:'CULTO',title,body:`${s.service_date} às ${String(s.service_time).slice(0,5)}. ${s.notes||''}`,level:'media',scheduled_for:dt.toISOString()});
    }
  }
}

