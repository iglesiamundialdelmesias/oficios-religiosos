/* ============================================================
   Sorei Saishi — capa de aplicación (modo local)
   Si Supabase está configurado, app.supabase.js sobrescribe
   saveAncestor/saveRequest/etc. y llama a hydrateFromSupabase().
   ============================================================ */

const KEY = "sorei_demo_v3";
const BACKEND = (window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
  !String(window.SUPABASE_URL).includes("TU-PROYECTO") &&
  !String(window.SUPABASE_ANON_KEY).includes("TU_ANON")) ? "supabase" : "local";
window.BACKEND = BACKEND;

let state = JSON.parse(localStorage.getItem(KEY) || "null") || {
  user: null,
  ancestors: [],
  requests: [],
  notifications: [],
  users: [],
  dept: { name: "Departamento Central", responsible: "", phone: "", hours: "" },
  config: { monthlyServiceWeekday: 0, monthlyServiceWeek: 1 }
};
let currentFilter = "";

/* ---------- Persistencia local ---------- */
function save() {
  if (window.BACKEND === "supabase") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

/* ---------- Utilidades ---------- */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}
function fmt(d) {
  if (!d) return "sin fecha";
  const x = new Date(d + "T00:00:00");
  if (isNaN(x)) return "sin fecha";
  return x.toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}
function iso(d) {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
}
function daysSince(d) {
  return Math.floor((Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000);
}
function daysUntil(d) {
  return Math.max(0, Math.ceil((new Date(d + "T00:00:00") - new Date()) / 86400000));
}
function empty(t) { return `<div class="meta" style="padding:12px">${esc(t)}</div>`; }

function toast(msg, kind = "") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.className = "toast show" + (kind ? " " + kind : "");
  el.textContent = msg;
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => { el.className = "toast"; }, 2800);
}
window.toast = toast;

/* ---------- Sesión ---------- */
function showLogin() {
  document.getElementById("loginView").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}
function showApp() {
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  applyRole(); refresh(); showView("inicio");
}
window.showLogin = showLogin;
window.showApp = showApp;

function logout() {
  if (window.BACKEND === "supabase" && window.supabaseSignOut) {
    window.supabaseSignOut();
  } else {
    state.user = null; save(); showLogin();
  }
}
window.logout = logout;

/* ---------- Rol / UI ---------- */
function applyRole() {
  const isAdmin = state.user?.role === "admin";
  document.getElementById("topDept").textContent = state.user?.dept || "";
  document.getElementById("sideRole").textContent = isAdmin ? "Administrador general" : "Responsable de iglesia";
  document.querySelectorAll(".admin-only,.admin-only-section").forEach(e => {
    e.style.display = isAdmin ? "" : "none";
  });
  document.getElementById("deptName").value = state.dept.name || "";
  document.getElementById("deptResponsible").value = state.dept.responsible || "";
  document.getElementById("deptPhone").value = state.dept.phone || "";
  document.getElementById("deptHours").value = state.dept.hours || "";
  document.getElementById("welcome").textContent = "Hola, " + (state.user?.name || "");
}
window.applyRole = applyRole;

function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("sidebarOverlay");
  const open = sb.classList.toggle("open");
  if (ov) ov.classList.toggle("active", open);
}
window.toggleSidebar = toggleSidebar;

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  document.querySelectorAll(".sidebar nav button").forEach(b =>
    b.classList.toggle("active", b.dataset.view === id));
  const titles = {
    inicio: "Inicio", antepasados: "Antepasados", linaje: "Linaje",
    solicitudes: "Solicitudes", cultos: "Cultos", notificaciones: "Notificaciones",
    departamento: "Departamento de iglesia", usuarios: "Usuarios"
  };
  document.getElementById("topTitle").textContent = titles[id] || "Inicio";
  if (innerWidth < 821) toggleSidebarClose();
  if (id === "antepasados") renderAncestors();
  if (id === "linaje") renderLinaje();
  if (id === "solicitudes") renderRequests();
  if (id === "cultos") renderCultos();
  if (id === "notificaciones") renderNotifications();
  if (id === "usuarios") renderUsers();
  window.scrollTo({ top: 0, behavior: "instant" });
}
window.showView = showView;

function toggleSidebarClose() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("active");
}

/* ---------- Refresh ---------- */
function refresh() {
  try {
    renderStats(); renderHome(); renderAncestors(); renderRequests();
    renderCultos(); renderNotifications(); renderUsers(); updateBadge();
  } catch (e) { console.error(e); }
}
window.refresh = refresh;

/* ---------- Stats / Home ---------- */
function renderStats() {
  document.getElementById("statAnc").textContent = state.ancestors.length;
  document.getElementById("statReq").textContent = state.requests.length;
  document.getElementById("statPending").textContent =
    state.requests.filter(r => r.status !== "Aprobado" && r.status !== "Rechazado").length;
  document.getElementById("statNotif").textContent =
    state.notifications.filter(n => !n.read).length;
}

function renderHome() {
  const c = generateCultos().slice(0, 4);
  document.getElementById("homeCultos").innerHTML =
    c.map(cultoHTML).join("") || empty("No hay fechas próximas.");
  const ns = state.notifications.filter(n => !n.read).slice(0, 4);
  document.getElementById("homeAlerts").innerHTML = ns.map(n =>
    `<div class="list-item"><div><h4>${esc(n.title)}</h4><div class="meta">${esc(n.text)}</div></div>
     <span class="badge ${n.level === "alta" ? "red" : n.level === "media" ? "warn" : ""}">${esc(n.level)}</span></div>`
  ).join("") || empty("No hay alertas pendientes.");
}

/* ---------- Antepasados ---------- */
function renderAncestors() {
  const q = (document.getElementById("ancestorSearch")?.value || "").toLowerCase();
  const rel = document.getElementById("ancestorRelFilter")?.value || "";
  const a = state.ancestors.filter(x =>
    (!q || `${x.spirit} ${x.family}`.toLowerCase().includes(q)) &&
    (!rel || x.relation === rel));
  document.getElementById("ancestorList").innerHTML = a.map(x =>
    `<div class="list-item">
       <div>
         <h4>${esc(x.spirit)}</h4>
         <div class="meta">${esc(x.family)} · ${esc(x.relation)} · fallecimiento: ${fmt(x.death)}</div>
         <div class="meta">${esc(x.status || "")}${x.lineage ? " · " + esc(x.lineage) : ""}</div>
       </div>
       <span class="badge">${esc(x.status || "")}</span>
     </div>`).join("") || empty("Aún no hay antepasados registrados.");
}

/* ---------- Linaje ---------- */
function renderLinaje() {
  const directo = state.ancestors.filter(a => a.lineage === "Directa");
  const indirecto = state.ancestors.filter(a => a.lineage === "Indirecta");
  const conyuge = state.ancestors.filter(a => a.lineage === "Cónyuge");
  const html = arr => arr.map(a =>
    `<div class="list-item"><div><h4>${esc(a.spirit)}</h4><div class="meta">${esc(a.relation)}</div></div></div>`
  ).join("") || empty("Sin registros.");
  document.getElementById("linajeDirecto").innerHTML = html(directo);
  document.getElementById("linajeIndirecto").innerHTML = html(indirecto);
  document.getElementById("linajeConyuge").innerHTML = html(conyuge);
}

/* ---------- Solicitudes ---------- */
function renderRequests() {
  const r = state.requests.filter(x => !currentFilter || x.status === currentFilter);
  document.getElementById("requestList").innerHTML = r.map(x =>
    `<div class="list-item">
       <div>
         <h4>${esc(x.type)}</h4>
         <div class="meta">${esc(x.spirit || x.family || "Solicitud")} · ${esc(x.department || "")} · ${fmt(x.created)}</div>
         <div class="meta">${esc(x.detail || x.notes || "")}</div>
       </div>
       <span class="badge ${x.status === "Pendiente" ? "warn" : x.status === "Revisión" ? "blue" : x.status === "Rechazado" ? "red" : ""}">${esc(x.status)}</span>
     </div>`).join("") || empty("No hay solicitudes.");
}
function filterRequests(f, ev) {
  currentFilter = f;
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  if (ev?.target) ev.target.classList.add("active");
  renderRequests();
}
window.filterRequests = filterRequests;

/* ---------- Notificaciones ---------- */
function renderNotifications() {
  document.getElementById("notificationList").innerHTML = state.notifications.map(n =>
    `<div class="list-item" style="${n.read ? 'opacity:.62' : ''}">
       <div>
         <h4>${esc(n.title)}</h4>
         <div class="meta">${esc(n.text)}</div>
         <small class="meta">${fmt(n.date)}</small>
       </div>
       <span class="badge ${n.level === "alta" ? "red" : n.level === "media" ? "warn" : ""}">${n.read ? "Leída" : n.level}</span>
     </div>`).join("") || empty("No hay notificaciones.");
}
function updateBadge() {
  document.getElementById("notifBadge").textContent =
    state.notifications.filter(n => !n.read).length;
}
function markNotificationsRead() {
  state.notifications.forEach(n => n.read = true);
  save(); refresh(); toast("Notificaciones marcadas como leídas");
}
window.markNotificationsRead = markNotificationsRead;

/* ---------- Usuarios (tabla responsive con data-label) ---------- */
function renderUsers() {
  const el = document.getElementById("userTable");
  if (!el) return;
  el.innerHTML = state.users.map(u =>
    `<tr>
       <td data-label="Usuario">${esc(u.name)}</td>
       <td data-label="Rol">${esc(u.role)}</td>
       <td data-label="Departamento">${esc(u.dept)}</td>
       <td data-label="Estado">${esc(u.status)}</td>
     </tr>`).join("");
}

/* ---------- Departamento ---------- */
function saveDepartment() {
  state.dept = {
    name: document.getElementById("deptName").value || "Departamento de iglesia",
    responsible: document.getElementById("deptResponsible").value,
    phone: document.getElementById("deptPhone").value,
    hours: document.getElementById("deptHours").value
  };
  state.user.dept = state.dept.name;
  save(); applyRole(); toast("Departamento actualizado");
}
window.saveDepartment = saveDepartment;

/* ---------- Modales ---------- */
function openModal(type) {
  const mc = document.getElementById("modalContent");
  if (type === "ancestor") mc.innerHTML = ancestorForm();
  if (type === "request") mc.innerHTML = requestForm();
  if (type === "user") mc.innerHTML = userForm(null);
  document.getElementById("modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.body.style.overflow = "";
}
window.openModal = openModal;
window.closeModal = closeModal;

function field(id, label, type = "text", ph = "", extra = "") {
  return `<div class="field"><label>${label}</label>
    <input id="f_${id}" type="${type}" placeholder="${ph}" ${extra}></div>`;
}
function selectField(id, label, opts) {
  return `<div class="field"><label>${label}</label>
    <select id="f_${id}">${opts.map(o => `<option>${o}</option>`).join("")}</select></div>`;
}
function val(id) { return document.getElementById("f_" + id)?.value || ""; }

function ancestorForm() {
  return `<h2>Registrar antepasado</h2>
  <p class="meta">Datos principales del formulario de Sorei Saishi.</p>
  <div class="form-grid">
    ${field("family", "Apellido / familia", "text", "Ej.: Oliveira, Silva…")}
    ${field("spirit", "Nombre del espíritu", "text", "Nombre completo, sin abreviaciones")}
    ${field("death", "Fecha de fallecimiento", "date")}
    ${field("age", "Edad al fallecer", "number", "Si < 1 año, usar 0", 'inputmode="numeric" min="0"')}
    ${selectField("sex", "Sexo", ["Masculino", "Femenino", "Indefinido"])}
    ${selectField("status", "Condición", ["Membro", "Frequentador"])}
    ${selectField("relation", "Parentesco", ["Padre/Madre","Abuelo/Abuela","Tío/Tía","Hermano/a","Hijo/a","Nieto/a","Cónyuge","Otro"])}
    ${selectField("lineage", "Tipo de linaje", ["Directa", "Indirecta", "Cónyuge"])}
    ${field("applicant", "Solicitante", "text")}
    ${field("code", "Código de solicitante", "text")}
    <div class="field full"><label>Observaciones</label><textarea id="f_obs" rows="3"></textarea></div>
  </div>
  <div class="modal-actions">
    <button class="btn secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn primary" onclick="saveAncestor()">Guardar antepasado</button>
  </div>`;
}

function requestForm() {
  return `<h2>Solicitar oficio religioso</h2>
  <p class="meta">El sistema calcula alertas y fechas a partir de los datos registrados.</p>
  <div class="form-grid">
    ${selectField("type", "Tipo de oficio", ["Sorei Saishi","Nensai","Ireisai","Shinrei Saishi","Maitokasai","Eidai Saishi"])}
    ${field("spirit", "Nombre del espíritu / linaje", "text", "Sin abreviaciones")}
    ${field("family", "Familia", "text")}
    ${field("death", "Fecha de fallecimiento", "date")}
    ${field("month", "Mes solicitado", "month")}
    ${selectField("relation", "Relación", ["Familiar","Amigo o conocido","Cónyuge","Linaje familiar"])}
    ${field("applicant", "Solicitante", "text")}
    ${field("code", "Código de solicitante", "text")}
    <div class="field full"><label>Notas</label><textarea id="f_notes" rows="3" placeholder="Información adicional"></textarea></div>
  </div>
  <div class="modal-actions">
    <button class="btn secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn primary" onclick="saveRequest()">Enviar solicitud</button>
  </div>`;
}

function userForm(user) {
  const isEdit = Boolean(user);
  const name = user?.full_name || user?.name || "";
  const email = user?.email || "";
  const role = user?.role || "RESPONSABLE_IGLESIA";
  const isAdminUser = state.user?.role === "admin";
  const isActive = user?.active !== false;

  return `<h2>${isEdit ? "Editar usuario" : "Nuevo usuario"}</h2>
  <p class="meta">${isEdit
    ? "Modifica los datos. Deja la contraseña vacía para no cambiarla."
    : "Se creará la cuenta con la contraseña que indiques."}</p>
  <div class="form-grid">
    <div class="field full"><label>Nombre completo</label>
      <input id="f_uname" type="text" value="${esc(name)}" placeholder="Nombre y apellido"></div>

    <div class="field full"><label>Correo electrónico</label>
      <input id="f_uemail" type="email" inputmode="email" value="${esc(email)}"
             ${isEdit ? "disabled" : ""} placeholder="correo@ejemplo.com">
      ${isEdit ? '<small>El correo no se puede cambiar.</small>' : ''}
    </div>

    <div class="field full"><label>${isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}</label>
      <input id="f_upassword" type="password" autocomplete="new-password"
             placeholder="${isEdit ? "Dejar vacío para no cambiar" : "Mínimo 6 caracteres"}">
    </div>

    <div class="field"><label>Rol</label>
      <select id="f_urole" ${!isAdminUser ? "disabled" : ""}>
        <option value="RESPONSABLE_IGLESIA" ${role === "RESPONSABLE_IGLESIA" ? "selected" : ""}>Responsable de iglesia</option>
        ${isAdminUser ? `<option value="ADMIN_GENERAL" ${role === "ADMIN_GENERAL" ? "selected" : ""}>Administrador general</option>` : ""}
      </select>
    </div>

    <div class="field"><label>Departamento de iglesia</label>
      <input id="f_udept" type="text" value="${esc(user?.departamento || state.dept?.name || "")}"
             placeholder="Nombre del departamento" ${!isAdminUser ? "disabled" : ""}></div>

    <div class="field"><label>Estado</label>
      <select id="f_uactive">
        <option value="true" ${isActive ? "selected" : ""}>Activo</option>
        <option value="false" ${!isActive ? "selected" : ""}>Inactivo</option>
      </select>
    </div>
  </div>

  <div class="modal-actions">
    <button class="btn secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn primary" onclick="saveUser(${isEdit ? `'${user.id}'` : "null"})">
      ${isEdit ? "Guardar cambios" : "Crear usuario"}
    </button>
  </div>`;
}

/* ---------- Guardar (modo local) ---------- */
function saveAncestor() {
  const x = {
    id: Date.now(),
    family: val("family"), spirit: val("spirit"), death: val("death"),
    age: val("age"), sex: val("sex"), status: val("status"),
    relation: val("relation"), lineage: val("lineage"),
    applicant: val("applicant"), code: val("code"),
    department: state.dept.name
  };
  if (!x.spirit || !x.death) { toast("Completa nombre y fecha de fallecimiento", "error"); return; }
  state.ancestors.push(x);
  addNotif("Nuevo antepasado registrado", `${x.spirit} fue registrado en ${state.dept.name}.`, "baja");
  save(); closeModal(); refresh(); toast("Antepasado registrado");
}
window.saveAncestor = saveAncestor;

function saveRequest() {
  const x = {
    id: Date.now(), type: val("type"), spirit: val("spirit"), family: val("family"),
    death: val("death"), month: val("month"), relation: val("relation"),
    applicant: val("applicant"), code: val("code"), notes: val("notes"),
    department: state.dept.name, status: "Pendiente",
    created: new Date().toISOString().slice(0, 10)
  };
  if (!x.spirit) { toast("Completa el nombre del espíritu o linaje", "error"); return; }
  const v = validateRequest(x);
  if (v) { toast(v, "error"); return; }
  state.requests.push(x);
  addNotif("Nueva solicitud", `${x.type}: ${x.spirit}. Requiere revisión del responsable.`, "media");
  save(); closeModal(); refresh(); toast("Solicitud enviada");
}
window.saveRequest = saveRequest;

function validateRequest(x) {
  if (x.type === "Shinrei Saishi" && x.death) {
    const d = daysSince(x.death);
    if (d > 50) return "Shinrei Saishi debe solicitarse antes de 50 días; usa Sorei Saishi.";
  }
  if ((x.type === "Nensai" || x.type === "Ireisai") && !x.month)
    return "Selecciona el mes solicitado.";
  return "";
}
window.validateRequest = validateRequest;

function saveUser() {
  state.users.push({
    name: val("uname"), role: val("urole"),
    dept: val("udept") || state.dept.name, status: val("ustatus")
  });
  save(); closeModal(); renderUsers(); toast("Usuario creado");
}
window.saveUser = saveUser;

/* ---------- Notificaciones internas ---------- */
function addNotif(title, text, level = "media") {
  state.notifications.unshift({
    id: Date.now() + Math.random(), title, text, level,
    date: new Date().toISOString().slice(0, 10), read: false
  });
}
window.addNotif = addNotif;

/* ---------- Cálculo de cultos (corregido) ---------- */
function generateCultos() {
  const out = [];
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const cfg = state.config || { monthlyServiceWeekday: 0, monthlyServiceWeek: 1 };

  for (let i = 0; i < 3; i++) {
    const yy = y, mm = m + i;

    // Maitokasai: días 5, 15, 25, 10:00
    [5, 15, 25].forEach(d => {
      out.push({
        date: iso(new Date(yy, mm, d)), name: "Maitokasai", time: "10:00",
        detail: "Programación mensual: día " + d + "."
      });
    });

    // Culto Mensual de Agradecimiento
    const mensual = nthWeekdayOfMonth(yy, mm, cfg.monthlyServiceWeekday, cfg.monthlyServiceWeek);
    // Sorei Saishi / Ireisai: primer domingo DESPUÉS del culto mensual
    const primerDomingoDespues = nextWeekdayAfter(mensual, 0);
    const cuartoDomingo = nthWeekdayOfMonth(yy, mm, 0, 4);

    out.push({
      date: iso(primerDomingoDespues), name: "Sorei Saishi / Ireisai", time: "09:00",
      detail: "Santuario de los Antepasados; primer domingo después del Culto Mensual de Agradecimiento."
    });
    out.push({
      date: iso(cuartoDomingo), name: "Sorei Saishi / Ireisai", time: "09:00",
      detail: "Santuario de los Antepasados; cuarto domingo del mes."
    });
  }
  return out
    .filter(x => new Date(x.date + "T23:59:00") >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date));
}
function nthWeekdayOfMonth(y, m, weekday, n) {
  const d = new Date(y, m, 1);
  let count = 0;
  while (d.getMonth() === ((m % 12) + 12) % 12) {
    if (d.getDay() === weekday && ++count === n) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return new Date(y, m, 1);
}
function nextWeekdayAfter(date, weekday) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d;
}
function cultoHTML(c) {
  return `<div class="list-item">
    <div><h4>${esc(c.name)}</h4>
    <div class="meta">${fmt(c.date)} · ${c.time} · ${esc(c.detail)}</div></div>
    <span class="badge">${daysUntil(c.date)} días</span></div>`;
}
function renderCultos() {
  document.getElementById("cultoList").innerHTML =
    generateCultos().map(c =>
      `<div class="calendar-item">
         <div class="date-box"><b>${new Date(c.date + "T00:00:00").getDate()}</b>
           <small>${new Date(c.date + "T00:00:00").toLocaleDateString("es-BO", { month: "short" })}</small></div>
         <div><h4>${esc(c.name)}</h4><div class="meta">${c.time} · ${esc(c.detail)}</div>
           <span class="badge">${daysUntil(c.date)} días</span></div>
       </div>`).join("");
}

/* ---------- Reglas de notificación por fechas ---------- */
function syncNotificationsFromRules() {
  if (window.BACKEND === "supabase") return;
  const today = new Date();
  state.requests.forEach(r => {
    if ((r.type === "Nensai" || r.type === "Ireisai") && r.month) {
      const target = new Date(r.month + "-01T00:00:00");
      const deadline = new Date(target);
      deadline.setMonth(deadline.getMonth() - 1);
      deadline.setDate(15);
      if (today >= new Date(deadline.getTime() - 7 * 86400000) && today <= target)
        addUniqueNotif("Fecha límite de solicitud",
          `${r.type} de ${r.spirit}: la solicitud debe gestionarse antes del día 15 del mes anterior.`,
          "alta", r.id + "deadline");
    }
    if (r.type === "Shinrei Saishi" && r.death) {
      const d = daysSince(r.death);
      if (d >= 35 && d < 50)
        addUniqueNotif("Shinrei Saishi próximo al límite",
          `${r.spirit} lleva ${d} días desde el fallecimiento. Debe solicitarse antes de 50 días.`,
          "alta", r.id + "50");
    }
  });
  save();
}
function addUniqueNotif(title, text, level, key) {
  if (state.notifications.some(n => n.key === key)) return;
  state.notifications.unshift({
    id: Date.now() + Math.random(), key, title, text, level,
    date: new Date().toISOString().slice(0, 10), read: false
  });
}

/* ---------- API pública ---------- */
window.getSoreiState = () => state;
window.state = state;

/* ---------- Boot ---------- */
function boot() {
  if (BACKEND === "supabase") return; // app.supabase.js gestiona el arranque
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved?.user) {
    state = saved;
    state.config = state.config || { monthlyServiceWeekday: 0, monthlyServiceWeek: 1 };
    showApp();
    syncNotificationsFromRules();
    refresh();
  } else {
    showLogin();
  }
  // Fallback de login local si Supabase no está configurado
  const lb = document.getElementById("supabaseLoginBtn");
  const sb = document.getElementById("supabaseSignupBtn");
  if (lb) lb.onclick = () => {
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPassword").value;
    if (!email || !pass) return toast("Completa correo y contraseña", "error");
    state.user = { name: email.split("@")[0], role: "admin", dept: state.dept.name || "Departamento Central" };
    save(); showApp(); toast("Sesión iniciada (modo local)");
  };
  if (sb) sb.onclick = () => toast("Configura Supabase para crear cuentas reales");
}
boot();