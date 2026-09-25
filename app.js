const KEY="sorei_demo_v1";
let state=JSON.parse(localStorage.getItem(KEY)||"null")||{
 user:{name:"Responsable de iglesia",role:"responsable",dept:"Departamento Central"},
 ancestors:[],
 requests:[],
 notifications:[],
 users:[
  {name:"Administrador general",role:"Administrador general",dept:"Todos",status:"Activo"},
  {name:"Responsable de iglesia",role:"Responsable de iglesia",dept:"Departamento Central",status:"Activo"}
 ],
 dept:{name:"Departamento Central",responsible:"Responsable de iglesia",phone:"",hours:""}
};
let currentFilter="";
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function login(){
 state.user={name:document.getElementById("loginName").value||"Usuario",role:document.getElementById("loginRole").value,dept:document.getElementById("loginDept").value||"Departamento de iglesia"};
 state.dept.name=state.user.dept; save(); document.getElementById("loginView").classList.add("hidden"); document.getElementById("app").classList.remove("hidden"); applyRole(); refresh(); showView("inicio");
}
function logout(){document.getElementById("app").classList.add("hidden");document.getElementById("loginView").classList.remove("hidden")}
function applyRole(){
 document.getElementById("topDept").textContent=state.user.dept;
 document.getElementById("sideRole").textContent=state.user.role==="admin"?"Administrador general":"Responsable de iglesia";
 document.querySelectorAll(".admin-only,.admin-only-section").forEach(e=>e.style.display=state.user.role==="admin"?"":"none");
 document.getElementById("deptName").value=state.dept.name; document.getElementById("deptResponsible").value=state.dept.responsible; document.getElementById("deptPhone").value=state.dept.phone; document.getElementById("deptHours").value=state.dept.hours;
}
function toggleSidebar(){document.getElementById("sidebar").classList.toggle("open")}
function showView(id){
 document.querySelectorAll(".view").forEach(v=>v.classList.remove("active")); document.getElementById(id).classList.add("active");
 document.querySelectorAll(".sidebar nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
 document.getElementById("topTitle").textContent={inicio:"Inicio",antepasados:"Antepasados",solicitudes:"Solicitudes",cultos:"Cultos",notificaciones:"Notificaciones",departamento:"Departamento de iglesia",usuarios:"Usuarios"}[id];
 if(innerWidth<821)document.getElementById("sidebar").classList.remove("open");
 if(id==="antepasados")renderAncestors(); if(id==="solicitudes")renderRequests(); if(id==="cultos")renderCultos(); if(id==="notificaciones")renderNotifications(); if(id==="usuarios")renderUsers();
}
function refresh(){renderStats();renderHome();renderAncestors();renderRequests();renderCultos();renderNotifications();renderUsers();updateBadge();}
function renderStats(){
 document.getElementById("statAnc").textContent=state.ancestors.length;document.getElementById("statReq").textContent=state.requests.length;
 document.getElementById("statPending").textContent=state.requests.filter(r=>r.status!=="Aprobado").length;
 document.getElementById("statNotif").textContent=state.notifications.filter(n=>!n.read).length;
}
function renderHome(){
 const c=generateCultos().slice(0,4); document.getElementById("homeCultos").innerHTML=c.map(cultoHTML).join("")||empty("No hay fechas próximas.");
 const ns=state.notifications.filter(n=>!n.read).slice(0,4); document.getElementById("homeAlerts").innerHTML=ns.map(n=>`<div class="list-item"><div><h4>${esc(n.title)}</h4><div class="meta">${esc(n.text)}</div></div><span class="badge ${n.level==="alta"?"red":n.level==="media"?"warn":""}">${n.level}</span></div>`).join("")||empty("No hay alertas pendientes.");
}
function empty(t){return `<div class="meta" style="padding:12px">${t}</div>`}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function renderAncestors(){
 const q=(document.getElementById("ancestorSearch")?.value||"").toLowerCase(), rel=document.getElementById("ancestorRelFilter")?.value||"";
 let a=state.ancestors.filter(x=>(!q||`${x.spirit} ${x.family}`.toLowerCase().includes(q))&&(!rel||x.relation===rel));
 document.getElementById("ancestorList").innerHTML=a.map(x=>`<div class="list-item"><div><h4>${esc(x.spirit)}</h4><div class="meta">${esc(x.family)} · ${esc(x.relation)} · fallecimiento: ${fmt(x.death)}</div></div><div><span class="badge">${esc(x.status)}</span></div></div>`).join("")||empty("Aún no hay antepasados registrados.");
}
function renderRequests(){
 let r=state.requests.filter(x=>!currentFilter||x.status===currentFilter);
 document.getElementById("requestList").innerHTML=r.map(x=>`<div class="list-item"><div><h4>${esc(x.type)}</h4><div class="meta">${esc(x.spirit||x.family||"Solicitud")} · ${esc(x.department)} · ${fmt(x.created)}</div><div class="meta">${esc(x.detail||"")}</div></div><span class="badge ${x.status==="Pendiente"?"warn":x.status==="Revisión"?"blue":""}">${esc(x.status)}</span></div>`).join("")||empty("No hay solicitudes.");
}
function filterRequests(f){currentFilter=f;document.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));event.target.classList.add("active");renderRequests()}
function renderNotifications(){
 document.getElementById("notificationList").innerHTML=state.notifications.map(n=>`<div class="list-item" style="${n.read?'opacity:.62':''}"><div><h4>${esc(n.title)}</h4><div class="meta">${esc(n.text)}</div><small class="meta">${fmt(n.date)}</small></div><span class="badge ${n.level==="alta"?"red":n.level==="media"?"warn":""}">${n.read?"Leída":n.level}</span></div>`).join("")||empty("No hay notificaciones.");
}
function updateBadge(){document.getElementById("notifBadge").textContent=state.notifications.filter(n=>!n.read).length}
function markNotificationsRead(){state.notifications.forEach(n=>n.read=true);save();refresh();toast("Notificaciones marcadas como leídas")}
function renderUsers(){const el=document.getElementById("userTable"); if(!el)return; el.innerHTML=state.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${esc(u.dept)}</td><td>${esc(u.status)}</td></tr>`).join("")}
function saveDepartment(){
 state.dept={name:document.getElementById("deptName").value||"Departamento de iglesia",responsible:document.getElementById("deptResponsible").value,phone:document.getElementById("deptPhone").value,hours:document.getElementById("deptHours").value}; state.user.dept=state.dept.name; save();applyRole();toast("Departamento actualizado");
}
function openModal(type){
 const mc=document.getElementById("modalContent");
 if(type==="ancestor") mc.innerHTML=ancestorForm();
 if(type==="request") mc.innerHTML=requestForm();
 if(type==="user") mc.innerHTML=userForm();
 document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function ancestorForm(){return `<h2>Registrar antepasado</h2><p class="meta">Datos principales del formulario de Sorei Saishi.</p><div class="form-grid">
${field("family","Apellido / familia","text","Ej.: Oliveira, Silva, Vieira…")}
${field("spirit","Nombre del espíritu","text","Nombre completo, sin abreviaciones")}
${field("death","Fecha de fallecimiento","date")}
${field("age","Edad al fallecer","number","Si tenía menos de 1 año, usar 0")}
${selectField("sex","Sexo",["Masculino","Femenino","Indefinido"])}
${selectField("status","Condición",["Membro","Frequentador"])}
${selectField("relation","Parentesco",["Padre/Madre","Abuelo/Abuela","Tío/Tía","Hermano/a","Hijo/a","Nieto/a","Cónyuge","Otro"])}
${field("applicant","Solicitante","text")}
${field("code","Código de solicitante","text")}
<div class="field full"><label>Observaciones</label><textarea id="f_obs" rows="3"></textarea></div></div>
<div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveAncestor()">Guardar antepasado</button></div>`}
function requestForm(){return `<h2>Solicitar oficio religioso</h2><p class="meta">El sistema calcula alertas y fechas a partir de los datos registrados.</p><div class="form-grid">
${selectField("type","Tipo de oficio",["Sorei Saishi","Nensai","Ireisai","Shinrei Saishi","Maitokasai","Eidai Saishi"])}
${field("spirit","Nombre del espíritu / linaje","text","Sin abreviaciones")}
${field("family","Familia","text")}
${field("death","Fecha de fallecimiento","date")}
${field("month","Mes solicitado","month")}
${selectField("relation","Relación",["Familiar","Amigo o conocido","Cónyuge","Linaje familiar"])}
${field("applicant","Solicitante","text")}
${field("code","Código de solicitante","text")}
<div class="field full"><label>Notas</label><textarea id="f_notes" rows="3" placeholder="Información adicional"></textarea></div></div>
<div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveRequest()">Enviar solicitud</button></div>`}
function userForm(){return `<h2>Nuevo usuario</h2><div class="form-grid">${field("uname","Nombre","text")}${selectField("urole","Rol",["Responsable de iglesia","Administrador general"])}${field("udept","Departamento de iglesia","text")}${selectField("ustatus","Estado",["Activo","Pendiente"])}</div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveUser()">Crear usuario</button></div>`}
function field(id,label,type="text",ph=""){return `<div class="field"><label>${label}</label><input id="f_${id}" type="${type}" placeholder="${ph}"></div>`}
function selectField(id,label,opts){return `<div class="field"><label>${label}</label><select id="f_${id}">${opts.map(o=>`<option>${o}</option>`).join("")}</select></div>`}
function val(id){return document.getElementById("f_"+id)?.value||""}
function saveAncestor(){
 const x={id:Date.now(),family:val("family"),spirit:val("spirit"),death:val("death"),age:val("age"),sex:val("sex"),status:val("status"),relation:val("relation"),applicant:val("applicant"),code:val("code"),department:state.dept.name};
 if(!x.spirit||!x.death){toast("Completa nombre y fecha de fallecimiento");return}
 state.ancestors.push(x); addNotif("Nuevo antepasado registrado",`${x.spirit} fue registrado en ${state.dept.name}.`,"baja");save();closeModal();refresh();toast("Antepasado registrado");
}
function saveRequest(){
 const x={id:Date.now(),type:val("type"),spirit:val("spirit"),family:val("family"),death:val("death"),month:val("month"),relation:val("relation"),applicant:val("applicant"),code:val("code"),notes:val("notes"),department:state.dept.name,status:"Pendiente",created:new Date().toISOString().slice(0,10)};
 if(!x.spirit){toast("Completa el nombre del espíritu o linaje");return}
 const validation=validateRequest(x); if(validation){toast(validation);return}
 state.requests.push(x); addNotif("Nueva solicitud",`${x.type}: ${x.spirit}. Requiere revisión del responsable.`,"media");save();closeModal();refresh();toast("Solicitud enviada");
}
function validateRequest(x){
 if(x.type==="Shinrei Saishi"&&x.death){const d=daysSince(x.death);if(d>50)return "Shinrei Saishi debe solicitarse antes de completar 50 días; registra el espíritu mediante Sorei Saishi si el plazo ya pasó."}
 if((x.type==="Nensai"||x.type==="Ireisai")&&!x.month)return "Selecciona el mes solicitado.";
 return "";
}
function saveUser(){state.users.push({name:val("uname"),role:val("urole"),dept:val("udept")||state.dept.name,status:val("ustatus")});save();closeModal();renderUsers();toast("Usuario creado")}
function daysSince(d){return Math.floor((Date.now()-new Date(d+"T00:00:00").getTime())/86400000)}
function fmt(d){if(!d)return "sin fecha";const x=new Date(d+"T00:00:00");return x.toLocaleDateString("es-BO",{day:"2-digit",month:"short",year:"numeric"})}
function addNotif(title,text,level="media"){state.notifications.unshift({id:Date.now()+Math.random(),title,text,level,date:new Date().toISOString().slice(0,10),read:false})}
function generateCultos(){
 const out=[]; const now=new Date(); const y=now.getFullYear(),m=now.getMonth();
 for(let i=0;i<3;i++){const dt=new Date(y,m+i,5);out.push({date:iso(dt),name:"Maitokasai",time:"10:00",detail:"Oficio de cada 10 días / transferencia y asentamiento (programación mensual: día 5)."});out.push({date:iso(new Date(y,m+i,15)),name:"Maitokasai",time:"10:00",detail:"Programación mensual: día 15."});out.push({date:iso(new Date(y,m+i,25)),name:"Maitokasai",time:"10:00",detail:"Programación mensual: día 25."});
  const firstSun=firstSundayAfterMonthly(y,m+i); const fourth=fourthSunday(y,m+i); out.push({date:iso(firstSun),name:"Sorei Saishi / Ireisai",time:"09:00",detail:"Santuario de los Antepasados; según la programación descrita en el libro."});out.push({date:iso(fourth),name:"Sorei Saishi / Ireisai",time:"09:00",detail:"Cuarto domingo del mes, según la programación descrita en el libro."});}
 return out.filter(x=>new Date(x.date+"T23:59:00")>=new Date()).sort((a,b)=>a.date.localeCompare(b.date));
}
function firstSundayAfterMonthly(y,m){let d=new Date(y,m,1);while(d.getDay()!==0)d.setDate(d.getDate()+1);return d}
function fourthSunday(y,m){let d=new Date(y,m,1),count=0;while(true){if(d.getDay()===0&&++count===4)return d;d.setDate(d.getDate()+1)}}
function iso(d){return d.toISOString().slice(0,10)}
function cultoHTML(c){return `<div class="list-item"><div><h4>${esc(c.name)}</h4><div class="meta">${fmt(c.date)} · ${c.time} · ${esc(c.detail)}</div></div><span class="badge">${daysUntil(c.date)} días</span></div>`}
function daysUntil(d){return Math.max(0,Math.ceil((new Date(d+"T00:00:00")-new Date())/86400000))}
function renderCultos(){document.getElementById("cultoList").innerHTML=generateCultos().map(c=>`<div class="calendar-item"><div class="date-box"><b>${new Date(c.date+"T00:00:00").getDate()}</b><small>${new Date(c.date+"T00:00:00").toLocaleDateString("es-BO",{month:"short"})}</small></div><div><h4>${esc(c.name)}</h4><div class="meta">${c.time} · ${esc(c.detail)}</div></div><span class="badge">${daysUntil(c.date)} días</span></div>`).join("")}
function syncNotificationsFromRules(){
 const today=new Date();
 state.requests.forEach(r=>{
  if((r.type==="Nensai"||r.type==="Ireisai")&&r.month){
   const target=new Date(r.month+"-01T00:00:00"); const deadline=new Date(target); deadline.setMonth(deadline.getMonth()-1); deadline.setDate(15);
   if(today>=new Date(deadline.getTime()-7*86400000)&&today<=target) addUniqueNotif("Fecha límite de solicitud",`${r.type} de ${r.spirit}: la solicitud debe gestionarse antes del día 15 del mes anterior.`,"alta",r.id+"deadline");
  }
  if(r.type==="Shinrei Saishi"&&r.death){
   const d=daysSince(r.death); if(d>=35&&d<50)addUniqueNotif("Shinrei Saishi próximo al límite",`${r.spirit} lleva ${d} días desde el fallecimiento. Debe solicitarse antes de 50 días.`,"alta",r.id+"50");
  }
 });
 save();
}
function addUniqueNotif(title,text,level,key){if(state.notifications.some(n=>n.key===key))return;state.notifications.unshift({id:Date.now()+Math.random(),key,title,text,level,date:new Date().toISOString().slice(0,10),read:false})}
window.getSoreiState=()=>state;
function boot(){
 if(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && !String(window.SUPABASE_URL).includes("TU-PROYECTO") && !String(window.SUPABASE_ANON_KEY).includes("TU_ANON")) return;
 if(state.user){document.getElementById("loginView").classList.add("hidden");document.getElementById("app").classList.remove("hidden");applyRole();syncNotificationsFromRules();refresh()}
}
boot();
