/* ============================================================
   SEGUIMIENTO DE RUTINA — lógica de la app
   ============================================================ */

// ---------- 1. Definición de la rutina (bloques del día) ----------
// Cada usuario (gerente o vendedor) tiene su propia plantilla de horario,
// guardada en su perfil (users/{uid}.scheduleId). SCHEDULE_TEMPLATES es el
// catálogo de plantillas disponibles; agregar una nueva rutina para otro
// vendedor es agregar una entrada más aquí.
const SCHEDULE_TEMPLATES = {
  gerente: {
    label: "Gerente de ventas",
    weekday: [
      { id: "pendientes_crm", label: "PENDIENTES CRM",                start: "10:00", end: "12:00" },
      { id: "embudo",      label: "Revisión de embudo",               start: "12:00", end: "12:30",
        metrics: [{ key: "leads_revisados", label: "# Leads revisados", type: "number" }] },
      { id: "reactivacion",label: "Reactivación de clientes",         start: "12:30", end: "14:00",
        metrics: [{ key: "llamadas", label: "# Llamadas de reactivación", type: "number" }] },
      { id: "comida",      label: "Comida",                           start: "14:00", end: "15:00", isBreak: true },
      { id: "cambaceo",    label: "Cambaceo / Prospección",           start: "15:00", end: "15:45",
        metrics: [{ key: "llamadas_cambaceo", label: "# Llamadas de cambaceo", type: "number" }] },
      { id: "mapeo_ia",    label: "Mapeo de Parsons con IA",          start: "15:45", end: "16:30",
        metrics: [{ key: "empresas_mapeadas", label: "# Empresas mapeadas", type: "number" }] },
      { id: "metricas",    label: "Revisión de métricas",             start: "16:30", end: "17:00" },
      { id: "reporte",     label: "Reporte diario CRM",               start: "17:00", end: "17:20" },
      { id: "asesoria",    label: "Coaching a vendedores",            start: "17:20", end: "18:00" },
    ],
    friday: [
      { id: "pendientes_crm", label: "PENDIENTES CRM",                start: "10:00", end: "12:00" },
      { id: "embudo",      label: "Revisión de embudo",               start: "12:00", end: "12:30",
        metrics: [{ key: "leads_revisados", label: "# Leads revisados", type: "number" }] },
      { id: "junta_prep",  label: "Preparación de junta",             start: "12:30", end: "14:00" },
      { id: "comida",      label: "Comida",                           start: "14:00", end: "15:00", isBreak: true },
      { id: "junta",       label: "Junta: reporte CRM con vendedores + métricas de reactivación y recompra",
        start: "15:00", end: "18:00" },
    ],
  },
  vendedor_a: {
    label: "Vendedor — 10 am a 6 pm",
    weekday: [
      { id: "pendientes_crm", label: "Pendientes CRM",               start: "10:00", end: "11:00" },
      { id: "recontacto",  label: "Recontactar leads sin respuesta", start: "11:00", end: "11:30",
        metrics: [{ key: "leads_recontactados", label: "# Leads recontactados", type: "number" }] },
      { id: "embudo",      label: "Revisión de embudo CRM",          start: "11:30", end: "12:30",
        metrics: [{ key: "leads_revisados", label: "# Leads revisados", type: "number" }] },
      { id: "reactivacion",label: "Reactivación de clientes",        start: "12:30", end: "14:00",
        metrics: [{ key: "llamadas", label: "# Llamadas de reactivación", type: "number" }] },
      { id: "comida",      label: "Comida",                          start: "14:00", end: "15:00", isBreak: true },
      { id: "prospectacion", label: "Prospectación",                 start: "15:00", end: "16:30",
        metrics: [{ key: "prospectos", label: "# Prospectos contactados", type: "number" }] },
      { id: "cotizaciones", label: "Realizar cotizaciones",          start: "16:40", end: "17:40",
        metrics: [{ key: "cotizaciones", label: "# Cotizaciones", type: "number" }] },
      { id: "planear_dia", label: "Planear día siguiente",           start: "17:40", end: "18:00" },
    ],
    friday: null, // mismo horario que el resto de la semana
  },
};
const DEFAULT_SCHEDULE_ID = "vendedor_a";
// Único correo que se reconoce automáticamente como gerente al crear cuenta.
const MANAGER_EMAIL = "alcantarahidalgoraulricardo@gmail.com";

const DIAS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function getBlocksForDate(date, scheduleId) {
  const template = SCHEDULE_TEMPLATES[scheduleId] || SCHEDULE_TEMPLATES.gerente;
  const day = date.getDay(); // 0 Dom - 6 Sab
  if (day >= 1 && day <= 4) return { type: "weekday", blocks: template.weekday };
  if (day === 5) return { type: "friday", blocks: template.friday || template.weekday };
  return { type: "weekend", blocks: [] };
}

function dateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function minutesNow(d) { return d.getHours() * 60 + d.getMinutes(); }
function toMinutes(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
function minutesFromTimestamp(ts) { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); }
function minutesToHHMM(min) {
  const clamped = Math.max(0, Math.round(min));
  const h = Math.floor(clamped / 60), m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------- 1b. Prioridades del día siguiente ----------
// Ventana en la que se pueden acomodar las 3 prioridades de mañana: 10:00–14:00.
const PRIORITY_WINDOW_START = 10 * 60;
const PRIORITY_WINDOW_END = 14 * 60;

function nextDate(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

// Mezcla los bloques fijos del día con las prioridades que se hayan planificado para ese
// día (guardadas la tarde/noche anterior). Cada prioridad se inserta en el punto de la
// franja 10:00–14:00 donde el usuario la haya querido acomodar, y las actividades fijas de
// esa franja se recortan proporcionalmente para hacerle espacio, sin mover la hora de comida.
function buildDayBlocksWithPriorities(baseBlocks, priorityTasks) {
  const placed = (priorityTasks || [])
    .filter((t) => t && t.title && t.title.trim() && t.start && t.duration > 0)
    .map((t) => ({ ...t, startMin: toMinutes(t.start) }))
    .sort((a, b) => a.startMin - b.startMin);

  if (!placed.length) return baseBlocks.slice();

  const inWindow = baseBlocks.filter((b) => toMinutes(b.start) >= PRIORITY_WINDOW_START && toMinutes(b.end) <= PRIORITY_WINDOW_END);
  const outsideBefore = baseBlocks.filter((b) => toMinutes(b.end) <= PRIORITY_WINDOW_START);
  const outsideAfter = baseBlocks.filter((b) => toMinutes(b.start) >= PRIORITY_WINDOW_END);

  const F = inWindow.reduce((sum, b) => sum + (toMinutes(b.end) - toMinutes(b.start)), 0);
  const P = placed.reduce((sum, t) => sum + t.duration, 0);
  const scale = F > 0 ? Math.max(0.1, Math.min(1, (F - P) / F)) : 1;

  const combined = [];
  let taskIdx = 0;
  inWindow.forEach((b) => {
    while (taskIdx < placed.length && placed[taskIdx].startMin < toMinutes(b.start)) {
      combined.push({ kind: "priority", task: placed[taskIdx] });
      taskIdx++;
    }
    combined.push({ kind: "fixed", block: b });
  });
  while (taskIdx < placed.length) {
    combined.push({ kind: "priority", task: placed[taskIdx] });
    taskIdx++;
  }

  let cursor = PRIORITY_WINDOW_START;
  const windowBlocks = [];
  combined.forEach((item) => {
    if (item.kind === "fixed") {
      const b = item.block;
      const origDur = toMinutes(b.end) - toMinutes(b.start);
      const newDur = Math.max(5, Math.round(origDur * scale));
      const start = cursor, end = start + newDur;
      windowBlocks.push({ ...b, start: minutesToHHMM(start), end: minutesToHHMM(end), _shrunk: scale < 0.999 });
      cursor = end;
    } else {
      const t = item.task;
      const start = cursor, end = start + t.duration;
      windowBlocks.push({
        id: `priority_${t.id}`, label: `⭐ ${t.title.trim()}`,
        start: minutesToHHMM(start), end: minutesToHHMM(end), isPriority: true,
      });
      cursor = end;
    }
  });
  if (windowBlocks.length) windowBlocks[windowBlocks.length - 1].end = minutesToHHMM(PRIORITY_WINDOW_END);

  return [...outsideBefore, ...windowBlocks, ...outsideAfter];
}

// Punto único: bloques "efectivos" de un día = bloques fijos (según la plantilla de
// horario del usuario) + prioridades planificadas. Si no se pasa scheduleId, usa el
// del usuario que tiene la sesión abierta.
function getEffectiveBlocksForDate(date, dayData, scheduleId) {
  const sid = scheduleId || currentScheduleId();
  const { type, blocks } = getBlocksForDate(date, sid);
  const priorityTasks = (dayData && dayData.priorityTasks) || [];
  if (!priorityTasks.length) return { type, blocks };
  return { type, blocks: buildDayBlocksWithPriorities(blocks, priorityTasks) };
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Minutos del bloque que quedaron dentro de algún bloqueo de horario (puede sumar varios bloqueos).
function lockOverlapMinutes(b, data) {
  if (!data || !data.locks || !data.locks.length) return 0;
  const s = toMinutes(b.start), e = toMinutes(b.end);
  let total = 0;
  data.locks.forEach((lock) => {
    const lockStartMin = minutesFromTimestamp(lock.start);
    const lockEndMin = lock.end ? minutesFromTimestamp(lock.end) : minutesNow(new Date());
    const overlapStart = Math.max(s, lockStartMin);
    const overlapEnd = Math.min(e, lockEndMin);
    total += Math.max(0, overlapEnd - overlapStart);
  });
  return total;
}

// Un bloque solo se considera "bloqueado" por completo (y libre de penalización) si el
// bloqueo de horario cubrió TODO su tiempo. Si solo cubrió una parte, el bloque sigue su
// estado normal y se muestra la parte proporcional bloqueada dentro de él.
function isBlockFullyLocked(b, data) {
  const s = toMinutes(b.start), e = toMinutes(b.end);
  const totalMin = e - s;
  if (totalMin <= 0) return false;
  return lockOverlapMinutes(b, data) >= totalMin - 0.5;
}

// ¿Este bloque cae dentro de un bloqueo de horario completo o se traslapa con una atención a lead?
function isBlockExcused(b, data) {
  if (!data) return false;
  if (isBlockFullyLocked(b, data)) return true;
  const s = toMinutes(b.start), e = toMinutes(b.end);
  return !!(data.leadSessions && data.leadSessions.some((sess) => {
    const sessStart = minutesFromTimestamp(sess.start);
    const sessEnd = sess.end ? minutesFromTimestamp(sess.end) : 24 * 60;
    return s < sessEnd && e > sessStart;
  }));
}

function getActiveLock(data) {
  if (!data || !data.locks || !data.locks.length) return null;
  const last = data.locks[data.locks.length - 1];
  return last && last.end == null ? last : null;
}

function getActiveLeadSession(data) {
  if (!data || !data.leadSessions || !data.leadSessions.length) return null;
  const last = data.leadSessions[data.leadSessions.length - 1];
  return last && last.end == null ? last : null;
}

// Bloque que está corriendo ahora mismo (para saber cuál se interrumpe al atender un lead)
function currentRunningBlockId() {
  const now = new Date();
  const { blocks } = getEffectiveBlocksForDate(now, todayData);
  if (!blocks.length) return null;
  const nowMin = minutesNow(now);
  const b = blocks.find((x) => !x.isBreak && toMinutes(x.start) <= nowMin && nowMin < toMinutes(x.end));
  return b ? b.id : null;
}

// Barra proporcional de tiempo "comido" dentro de un bloque, por atención a leads o por
// bloqueos de horario. Reparte cada evento por traslape real de horario, así que si cruza
// de un bloque a otro, cada bloque solo se lleva la parte que realmente le tocó.
function interruptionBarHtml(block, sessions, opts) {
  if (!sessions || !sessions.length) return "";
  const o = Object.assign({
    color: "bg-orange-500", textColor: "text-orange-400", label: "Interrumpido por lead",
    nameKey: "name", noteKey: "closingNote", fallbackName: "Lead",
  }, opts || {});
  const blockStartMin = toMinutes(block.start), blockEndMin = toMinutes(block.end);
  const totalMin = blockEndMin - blockStartMin;
  if (totalMin <= 0) return "";
  let totalInterrupted = 0;
  const segments = [];
  const notes = [];
  sessions.forEach((s) => {
    const sessStartMin = minutesFromTimestamp(s.start);
    const sessEndMin = s.end ? minutesFromTimestamp(s.end) : minutesNow(new Date());
    const overlapStart = Math.max(blockStartMin, sessStartMin);
    const overlapEnd = Math.min(blockEndMin, sessEndMin);
    const overlapMin = Math.max(0, overlapEnd - overlapStart);
    if (overlapMin <= 0) return;
    totalInterrupted += overlapMin;
    const leftPct = ((overlapStart - blockStartMin) / totalMin) * 100;
    const widthPct = (overlapMin / totalMin) * 100;
    const name = s[o.nameKey] || o.fallbackName;
    segments.push(`<div class="absolute top-0 bottom-0 ${o.color}" style="left:${leftPct}%; width:${widthPct}%;" title="${escapeHtml(name)}"></div>`);
    const note = s[o.noteKey];
    if (note && note.trim()) {
      notes.push(`<p class="text-[10px] text-gray-400 mt-0.5 italic">"${escapeHtml(note)}" — ${escapeHtml(name)}</p>`);
    }
  });
  if (!segments.length) return "";
  return `
    <div class="relative h-1.5 rounded-full bg-gray-700/50 mt-1.5 overflow-hidden">${segments.join("")}</div>
    <p class="text-[10px] ${o.textColor} mt-0.5">${o.label}: ${Math.round(totalInterrupted)} min</p>
    ${notes.join("")}
  `;
}
const LOCK_BAR_OPTS = {
  color: "bg-violet-500", textColor: "text-violet-400", label: "Bloqueado por horario",
  nameKey: "reason", noteKey: "justification", fallbackName: "Bloqueo",
};

// ---------- 2. Firebase ----------
let auth, db, currentUser = null;
let firebaseReady = false;
try {
  firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  db = firebase.firestore();
  firebaseReady = true;
} catch (e) {
  console.error("Firebase no se pudo inicializar. Revisa firebase-config.js", e);
}

// ---------- 3. Estado en memoria ----------
let todayData = { blocks: {}, leadSessions: [], locks: [], priorityTasks: [] };
let todayUnsub = null;
let activeTab = "hoy";
let editingBlockId = null;
let weekCache = {}; // dateStr -> { date, type, blocks, data, points }
let currentUserProfile = null; // { name, role: "gerente"|"vendedor", scheduleId, teamId }
const TEAM_ID = "parsons";
function currentScheduleId() {
  return (currentUserProfile && currentUserProfile.scheduleId) || "gerente";
}
function isManager() {
  return !!(currentUserProfile && currentUserProfile.role === "gerente");
}
function teamMemberRef(uid) {
  return db.collection("teams").doc(TEAM_ID).collection("members").doc(uid);
}
function userDocRef(uid) {
  return db.collection("users").doc(uid);
}

// ---------- 4. Utilidades UI ----------
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }
function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add("hidden"), 2200);
}

// ---------- 4b. Splash de apertura ----------
(function () {
  const splash = document.getElementById("splash");
  if (!splash) return;
  const video = document.getElementById("splash-video");
  let closed = false;
  const closeSplash = () => {
    if (closed) return;
    closed = true;
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 500);
  };
  // Respaldo por si el video no puede reproducirse (autoplay bloqueado, error, etc.)
  const fallback = setTimeout(closeSplash, 6000);
  if (video) {
    video.addEventListener("ended", () => { clearTimeout(fallback); closeSplash(); });
    video.addEventListener("error", () => { clearTimeout(fallback); closeSplash(); });
    video.play().catch(() => { clearTimeout(fallback); closeSplash(); });
  } else {
    clearTimeout(fallback);
    setTimeout(closeSplash, 1350);
  }
})();

// ---------- 4c. Tema claro / oscuro ----------
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#2563eb");
  try { localStorage.setItem("theme", theme); } catch (e) {}
  const dark = $("#btn-theme-dark"), light = $("#btn-theme-light");
  if (dark && light) {
    dark.className = "flex-1 rounded-lg py-2 text-xs font-medium transition " + (theme === "dark" ? "bg-blue-600 text-white" : "text-gray-400");
    light.className = "flex-1 rounded-lg py-2 text-xs font-medium transition " + (theme === "light" ? "bg-blue-600 text-white" : "text-gray-400");
  }
  if (currentUser) renderStatsTab(); // los colores de las gráficas dependen del tema
}
$("#btn-theme-dark").addEventListener("click", () => applyTheme("dark"));
$("#btn-theme-light").addEventListener("click", () => applyTheme("light"));
applyTheme(document.body.classList.contains("light") ? "light" : "dark");

// ---------- 5. Autenticación ----------
// Opciones del selector de horario (todas las plantillas menos la del gerente,
// que se asigna sola por correo). Agregar un vendedor con horario nuevo = agregar
// una entrada en SCHEDULE_TEMPLATES y aparece aquí automáticamente.
(function populateScheduleSelect() {
  const sel = $("#auth-schedule");
  if (!sel) return;
  sel.innerHTML = "";
  Object.keys(SCHEDULE_TEMPLATES).forEach((key) => {
    if (key === "gerente") return;
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = SCHEDULE_TEMPLATES[key].label;
    sel.appendChild(opt);
  });
})();

let pendingSignup = null; // { name, scheduleId } — se usa una sola vez al crear cuenta

$("#btn-signin").addEventListener("click", async () => {
  const email = $("#auth-email").value.trim();
  const pass = $("#auth-password").value;
  if (!email || !pass) return showAuthError("Escribe correo y contraseña.");
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) { showAuthError(traduceError(e)); }
});
$("#btn-signup").addEventListener("click", async () => {
  const email = $("#auth-email").value.trim();
  const pass = $("#auth-password").value;
  if (!email || !pass) return showAuthError("Escribe correo y contraseña.");
  if (pass.length < 6) return showAuthError("La contraseña debe tener al menos 6 caracteres.");
  const name = ($("#auth-name").value || "").trim() || email.split("@")[0];
  const scheduleId = $("#auth-schedule").value || DEFAULT_SCHEDULE_ID;
  pendingSignup = { name, scheduleId };
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
  } catch (e) { pendingSignup = null; showAuthError(traduceError(e)); }
});
$("#btn-signout").addEventListener("click", () => auth.signOut());

// Crea o carga el perfil (nombre, rol, horario) del usuario que inició sesión, y
// lo registra/actualiza en el roster del equipo para que el gerente lo pueda ver.
async function ensureUserProfile(user) {
  const ref = userDocRef(user.uid);
  const snap = await ref.get();
  if (snap.exists && snap.data() && snap.data().role) {
    currentUserProfile = snap.data();
  } else {
    const isBoss = user.email === MANAGER_EMAIL;
    const profile = {
      name: (pendingSignup && pendingSignup.name) || (snap.exists && snap.data() && snap.data().name) || user.email.split("@")[0],
      role: isBoss ? "gerente" : "vendedor",
      scheduleId: isBoss ? "gerente" : ((pendingSignup && pendingSignup.scheduleId) || DEFAULT_SCHEDULE_ID),
      teamId: TEAM_ID,
      email: user.email,
    };
    await ref.set(profile, { merge: true });
    currentUserProfile = profile;
  }
  pendingSignup = null;
  await teamMemberRef(user.uid).set({
    uid: user.uid, name: currentUserProfile.name, role: currentUserProfile.role,
    scheduleId: currentUserProfile.scheduleId, email: user.email,
  }, { merge: true });
}

function showAuthError(msg) {
  const el = $("#auth-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}
function traduceError(e) {
  const map = {
    "auth/invalid-email": "Correo inválido.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo, mejor entra con 'Entrar'.",
    "auth/weak-password": "La contraseña es muy débil (mínimo 6 caracteres).",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
  };
  return map[e.code] || "Ocurrió un error. Intenta de nuevo.";
}

if (firebaseReady) {
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      try {
        await ensureUserProfile(user);
      } catch (e) {
        showAuthError("No se pudo cargar tu perfil: " + e.message);
        currentUserProfile = currentUserProfile || { name: user.email, role: "vendedor", scheduleId: DEFAULT_SCHEDULE_ID };
      }
      $("#auth-screen").classList.add("hidden");
      $("#main-app").classList.remove("hidden");
      $("#btn-fab-lead").classList.remove("hidden");
      $("#settings-name").textContent = currentUserProfile.name || "—";
      $("#settings-email").textContent = user.email;
      $("#settings-role").textContent = isManager()
        ? "Gerente de ventas"
        : `Vendedor · ${(SCHEDULE_TEMPLATES[currentUserProfile.scheduleId] || {}).label || currentUserProfile.scheduleId}`;
      $("#tab-btn-equipo").classList.toggle("hidden", !isManager());
      initTodayListener();
      renderWeekTab();
      renderStatsTab();
      renderLeadsTab();
      registerServiceWorker();
    } else {
      currentUserProfile = null;
      $("#auth-screen").classList.remove("hidden");
      $("#main-app").classList.add("hidden");
      $("#btn-fab-lead").classList.add("hidden");
      $("#tab-btn-equipo").classList.add("hidden");
      if (todayUnsub) todayUnsub();
    }
  });
} else {
  $("#auth-screen").classList.remove("hidden");
  showAuthError("Falta configurar Firebase (revisa firebase-config.js).");
}

// ---------- 6. Referencia a Firestore del día ----------
function dayDocRef(date) {
  return db.collection("users").doc(currentUser.uid).collection("days").doc(dateStr(date));
}

function initTodayListener() {
  const today = new Date();
  if (todayUnsub) todayUnsub();
  todayUnsub = dayDocRef(today).onSnapshot((snap) => {
    todayData = snap.exists ? snap.data() : { blocks: {}, leadSessions: [], locks: [] };
    if (!todayData.blocks) todayData.blocks = {};
    if (!todayData.leadSessions) todayData.leadSessions = [];
    if (!todayData.locks) todayData.locks = [];
    if (!todayData.priorityTasks) todayData.priorityTasks = [];
    renderToday();
    computeStreak();
  });
}

// ---------- 7. Puntos ----------
function computeDayPoints(data, blocks) {
  let points = 0;
  const realBlocks = blocks.filter((b) => !b.isBreak);
  let allDone = realBlocks.length > 0;
  realBlocks.forEach((b) => {
    const bd = (data.blocks && data.blocks[b.id]) || {};
    if (bd.completed) {
      points += 10;
      const hasNotes = bd.notes && bd.notes.trim().length > 0;
      const hasMetrics = bd.metrics && Object.values(bd.metrics).some((v) => v !== "" && v !== null && v !== undefined);
      if (hasNotes || hasMetrics) points += 5;
    } else if (isBlockExcused(b, data)) {
      // cae dentro de un bloqueo de horario: no cuenta en contra ni rompe la racha
    } else {
      allDone = false;
    }
  });
  if (allDone) points += 25;
  (data.leadSessions || []).forEach((s) => {
    points += 10;
    if (typeof s.responseMinutes === "number" && s.responseMinutes <= 15) points += 10;
    if (s.end && typeof s.durationMinutes === "number") points += 5;
  });
  (data.locks || []).forEach((l) => {
    if (l.end && l.justification && l.justification.trim()) points += 5;
  });
  return { points, allDone };
}

// ---------- 8. Render tab Hoy ----------
function blockStatus(b, bd, nowMin, data) {
  if (b.isBreak) return "break";
  if (bd && bd.completed) return "done";
  if (isBlockExcused(b, data)) return "blocked";
  const s = toMinutes(b.start), e = toMinutes(b.end);
  if (nowMin < s) return "upcoming";
  if (nowMin >= s && nowMin <= e) return "current";
  return "missed";
}
const STATUS_LABEL = { done: "Completado", current: "En curso", missed: "Pendiente (venció)", upcoming: "Próximo", break: "Descanso", blocked: "Bloqueado (justificado)" };

// Estado de un bloque para un día que no necesariamente es hoy (usado en el detalle semanal)
function historicalStatus(b, bd, date, data) {
  if (b.isBreak) return "break";
  if (bd && bd.completed) return "done";
  if (isBlockExcused(b, data)) return "blocked";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cmp = new Date(date);
  cmp.setHours(0, 0, 0, 0);
  if (cmp.getTime() === today.getTime()) return blockStatus(b, bd, minutesNow(new Date()), data);
  if (cmp.getTime() > today.getTime()) return "upcoming";
  return "missed";
}

// Banner para planificar (o revisar) las 3 prioridades de mañana. Se muestra siempre,
// incluso en días sin rutina fija (fines de semana), porque el domingo se planea el
// lunes, el lunes se planea el martes, etc.
function buildPriorityBanner() {
  const tomorrow = nextDate(new Date());
  const tomorrowLabel = DIAS_ES[tomorrow.getDay()];
  const tasks = (todayData.tomorrowPriorityTasks || []).filter((t) => t && t.title && t.title.trim());
  const box = document.createElement("div");
  if (tasks.length) {
    box.className = "bg-amber-950/30 border border-amber-700/50 rounded-xl p-3 fade-in";
    box.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium text-amber-300">⭐ ${tomorrowLabel} ya está planeado</p>
        <button id="btn-priorities-edit" class="text-xs text-amber-400 shrink-0">Editar</button>
      </div>
      <p class="text-[11px] text-amber-500/80 mt-1">${tasks.map((t) => escapeHtml(t.title)).join(" · ")}</p>
    `;
  } else {
    box.className = "bg-gray-900 border border-gray-800 rounded-xl p-3 fade-in";
    box.innerHTML = `
      <button id="btn-priorities-open" class="w-full flex items-center justify-between gap-2 text-left">
        <span class="text-sm font-medium">📋 Planifica ${tomorrowLabel}</span>
        <span class="text-xs text-blue-400 shrink-0">Elegir 3 prioridades ›</span>
      </button>
    `;
  }
  const openBtn = box.querySelector("#btn-priorities-open");
  if (openBtn) openBtn.addEventListener("click", openPrioritiesModal);
  const editBtn = box.querySelector("#btn-priorities-edit");
  if (editBtn) editBtn.addEventListener("click", openPrioritiesModal);
  return box;
}

function renderToday() {
  const now = new Date();
  const { blocks } = getEffectiveBlocksForDate(now, todayData);
  $("#today-label").textContent = `${DIAS_ES[now.getDay()]} · ${dateStr(now)}`;
  $("#today-title").textContent = blocks.length ? "Rutina de hoy" : "Sin rutina hoy";

  const nowMin = minutesNow(now);
  const container = $("#tab-hoy");
  container.innerHTML = "";

  container.appendChild(buildPriorityBanner());

  if (!blocks.length) {
    const empty = document.createElement("div");
    empty.className = "text-center text-gray-500 text-sm py-16";
    empty.textContent = "Hoy no tienes bloques programados. Buen descanso. 🙌";
    container.appendChild(empty);
    $("#points-today").textContent = "0";
    clearInterval(lockTimerInterval);
    updateLeadFab();
    return;
  }

  // Botón / banner de bloqueo de horario
  const activeLock = getActiveLock(todayData);
  const lockBox = document.createElement("div");
  if (activeLock) {
    lockBox.className = "bg-violet-950/60 border border-violet-700 rounded-xl p-3 flex items-center justify-between gap-2 fade-in";
    lockBox.innerHTML = `
      <div>
        <p class="text-sm font-medium text-violet-200">🔒 ${escapeHtml(activeLock.reason || "Sin motivo")}</p>
        <p class="text-[11px] text-violet-400" id="lock-timer">00:00</p>
      </div>
      <button id="btn-unlock" class="bg-violet-600 hover:bg-violet-500 transition rounded-xl px-4 py-2 text-xs font-medium shrink-0">Desbloquear</button>
    `;
  } else {
    clearInterval(lockTimerInterval);
    lockBox.innerHTML = `
      <button id="btn-lock-start" class="w-full bg-gray-900 border border-gray-800 hover:border-violet-700 transition rounded-xl px-4 py-2.5 text-xs font-medium text-gray-400 flex items-center justify-center gap-2">
        🔒 Bloquear horario (salida con cliente / imprevisto)
      </button>
    `;
  }
  container.appendChild(lockBox);
  if (activeLock) {
    startLockTimer(activeLock.start);
    $("#btn-unlock").addEventListener("click", openUnlockModal);
  } else {
    $("#btn-lock-start").addEventListener("click", openLockModal);
  }

  blocks.forEach((b) => {
    const bd = (todayData.blocks && todayData.blocks[b.id]) || {};
    const status = blockStatus(b, bd, nowMin, todayData);
    const card = document.createElement("div");
    card.className = `status-${status} border-l-4 rounded-xl p-3 flex items-start gap-3 fade-in`;

    const hasMetrics = b.metrics && b.metrics.length > 0;
    const metricSummary = hasMetrics && bd.metrics
      ? b.metrics.map((m) => (bd.metrics[m.key] ? `${m.label.replace(/^# /,"")}: ${bd.metrics[m.key]}` : null)).filter(Boolean).join(" · ")
      : "";
    const leadSessionsForBlock = todayData.leadSessions || []; // interruptionBarHtml filtra por traslape de horario
    const locksForBlock = todayData.locks || [];

    let remainingHtml = "";
    if (status === "current" && !b.isBreak) {
      const remainingMin = Math.max(0, toMinutes(b.end) - nowMin);
      const urgentClass = remainingMin <= 5 ? "text-red-400" : "text-blue-400";
      remainingHtml = `<p class="text-[11px] ${urgentClass} mt-0.5">⏳ Te faltan ${remainingMin} min para terminar</p>`;
    }

    card.innerHTML = `
      <button data-toggle="${b.id}" class="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 ${b.isBreak ? "border-gray-600" : "border-gray-500"} flex items-center justify-center ${bd.completed ? "bg-green-600 border-green-600" : ""}">
        ${bd.completed ? '<span class="text-xs">✓</span>' : ""}
      </button>
      <div class="flex-1 min-w-0" data-open="${b.id}">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-medium ${b.isBreak ? "text-gray-400" : ""}">${escapeHtml(b.label)}</p>
          <span class="text-[10px] text-gray-500 shrink-0">${b.start}–${b.end}</span>
        </div>
        <p class="text-[11px] text-gray-500 mt-0.5">${STATUS_LABEL[status]}${bd.notes ? " · con notas" : ""}${b._shrunk ? " · horario recortado" : ""}</p>
        ${metricSummary ? `<p class="text-[11px] text-blue-400 mt-0.5">${escapeHtml(metricSummary)}</p>` : ""}
        ${remainingHtml}
        ${interruptionBarHtml(b, leadSessionsForBlock)}
        ${interruptionBarHtml(b, locksForBlock, LOCK_BAR_OPTS)}
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-toggle]").forEach((el) =>
    el.addEventListener("click", (e) => toggleBlock(el.dataset.toggle, blocks, e))
  );
  container.querySelectorAll("[data-open]").forEach((el) =>
    el.addEventListener("click", () => openBlockModal(el.dataset.open, blocks))
  );

  const { points } = computeDayPoints(todayData, blocks);
  $("#points-today").textContent = points;
  updateLeadFab();
}

// Refresca la vista de Hoy cada 30s para que los bloques pasen de "próximo" a "en curso"
// a "pendiente" solos, y para que el contador de tiempo restante se mantenga al día.
setInterval(() => {
  if (currentUser && activeTab === "hoy") renderToday();
}, 30000);

// ---------- Prioridades de mañana ----------
function openPrioritiesModal() {
  const existing = todayData.tomorrowPriorityTasks || [];
  for (let i = 0; i < 3; i++) {
    const t = existing[i] || {};
    const titleEl = document.querySelector(`[data-priority-title="${i}"]`);
    const startEl = document.querySelector(`[data-priority-start="${i}"]`);
    const durEl = document.querySelector(`[data-priority-duration="${i}"]`);
    if (titleEl) titleEl.value = t.title || "";
    if (startEl) startEl.value = t.start || "";
    if (durEl) durEl.value = t.duration ? String(t.duration) : "30";
  }
  $("#priority-error").classList.add("hidden");
  $("#modal-priorities").classList.remove("hidden");
}
$("#btn-priorities-cancel").addEventListener("click", () => $("#modal-priorities").classList.add("hidden"));
$all("[data-priority-clear]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const i = btn.dataset.priorityClear;
    const titleEl = document.querySelector(`[data-priority-title="${i}"]`);
    const startEl = document.querySelector(`[data-priority-start="${i}"]`);
    if (titleEl) titleEl.value = "";
    if (startEl) startEl.value = "";
  });
});
$("#btn-priorities-save").addEventListener("click", () => {
  const errEl = $("#priority-error");
  errEl.classList.add("hidden");
  const tasks = [];
  for (let i = 0; i < 3; i++) {
    const title = (document.querySelector(`[data-priority-title="${i}"]`).value || "").trim();
    const start = document.querySelector(`[data-priority-start="${i}"]`).value;
    const duration = Number(document.querySelector(`[data-priority-duration="${i}"]`).value || 30);
    if (!title) continue; // fila vacía = se omite (equivale a "borrarla")
    if (!start) {
      errEl.textContent = `Ponle una hora a "${title}".`;
      errEl.classList.remove("hidden");
      return;
    }
    const startMin = toMinutes(start);
    if (startMin < PRIORITY_WINDOW_START || startMin + duration > PRIORITY_WINDOW_END) {
      errEl.textContent = `"${title}" debe caber entre las 10:00 am y las 2:00 pm.`;
      errEl.classList.remove("hidden");
      return;
    }
    tasks.push({ id: `p${i}`, title, start, duration });
  }
  const sorted = [...tasks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].start) + sorted[i - 1].duration) {
      errEl.textContent = `"${sorted[i].title}" se traslapa con "${sorted[i - 1].title}".`;
      errEl.classList.remove("hidden");
      return;
    }
  }
  const totalPriorityMin = tasks.reduce((sum, t) => sum + t.duration, 0);
  if (totalPriorityMin > 180) {
    errEl.textContent = "Deja al menos 1 hora libre para tus actividades fijas de la mañana (máximo 3 horas en total de prioridades).";
    errEl.classList.remove("hidden");
    return;
  }
  const tomorrow = nextDate(new Date());
  dayDocRef(tomorrow).set({ priorityTasks: tasks }, { merge: true })
    .then(() => {
      saveToday({ tomorrowPriorityTasks: tasks });
      $("#modal-priorities").classList.add("hidden");
      showToast(tasks.length ? "Prioridades de mañana guardadas" : "Prioridades de mañana borradas");
    })
    .catch((e) => {
      errEl.textContent = "Error al guardar: " + e.message;
      errEl.classList.remove("hidden");
    });
});

// ---------- Atender lead (inicio / fin de llamada, duración automática) ----------
let leadTimerInterval = null;
let leadEndModalInterval = null;

function updateLeadFab() {
  const fab = $("#btn-fab-lead");
  if (!fab) return;
  const active = getActiveLeadSession(todayData);
  if (active) {
    fab.innerHTML = `<span class="text-lg leading-none">☎️</span> Llamada terminada <span id="lead-timer" class="opacity-80">00:00</span>`;
    fab.classList.remove("bg-orange-500", "hover:bg-orange-400");
    fab.classList.add("bg-red-600", "hover:bg-red-500");
    fab.onclick = openLeadEndModal;
    startLeadTimer(active.start);
  } else {
    clearInterval(leadTimerInterval);
    fab.innerHTML = `<span class="text-lg leading-none">📞</span> Atender Lead`;
    fab.classList.remove("bg-red-600", "hover:bg-red-500");
    fab.classList.add("bg-orange-500", "hover:bg-orange-400");
    fab.onclick = openLeadStartModal;
  }
}

function startLeadTimer(startTs) {
  clearInterval(leadTimerInterval);
  const update = () => {
    const el = document.getElementById("lead-timer");
    if (!el) { clearInterval(leadTimerInterval); return; }
    el.textContent = formatDuration(Date.now() - startTs);
  };
  update();
  leadTimerInterval = setInterval(update, 1000);
}

function openLeadStartModal() {
  $("#lead-name-input").value = "";
  $("#lead-response-input").value = "";
  $("#lead-note-input").value = "";
  $("#lead-name-error").classList.add("hidden");
  $("#modal-lead-start").classList.remove("hidden");
}
$("#btn-lead-start-cancel").addEventListener("click", () => $("#modal-lead-start").classList.add("hidden"));
$("#btn-lead-start-confirm").addEventListener("click", () => {
  const name = $("#lead-name-input").value.trim();
  if (!name) { $("#lead-name-error").classList.remove("hidden"); return; }
  const responseMinutes = Number($("#lead-response-input").value || 0);
  const note = $("#lead-note-input").value.trim();
  const session = {
    name, responseMinutes, note,
    start: Date.now(), end: null, durationMinutes: null,
    blockId: currentRunningBlockId(), // referencia informativa, la barra usa traslape real de horario
  };
  const leadSessions = [...(todayData.leadSessions || []), session];
  saveToday({ leadSessions });
  $("#modal-lead-start").classList.add("hidden");
  showToast("Atención de lead iniciada — cronómetro corriendo");
});

function openLeadEndModal() {
  const session = getActiveLeadSession(todayData);
  if (!session) return;
  $("#lead-end-name").textContent = session.name || "—";
  $("#lead-closing-note").value = "";
  clearInterval(leadEndModalInterval);
  const update = () => { $("#lead-end-duration").textContent = formatDuration(Date.now() - session.start); };
  update();
  leadEndModalInterval = setInterval(update, 1000);
  $("#modal-lead-end").classList.remove("hidden");
}
$("#btn-lead-end-cancel").addEventListener("click", () => {
  clearInterval(leadEndModalInterval);
  $("#modal-lead-end").classList.add("hidden");
});
$("#btn-lead-end-confirm").addEventListener("click", () => {
  const sessions = [...(todayData.leadSessions || [])];
  const idx = sessions.length - 1;
  if (idx < 0) return;
  const s = sessions[idx];
  const durationMinutes = Math.max(1, Math.round((Date.now() - s.start) / 60000));
  const closingNote = $("#lead-closing-note").value.trim();
  sessions[idx] = { ...s, end: Date.now(), durationMinutes, closingNote };
  saveToday({ leadSessions: sessions });
  clearInterval(leadEndModalInterval);
  $("#modal-lead-end").classList.add("hidden");
  showToast("Llamada registrada");
});

// ---------- Bloqueo de horario (salidas / imprevistos) ----------
let lockTimerInterval = null;

function startLockTimer(startTs) {
  clearInterval(lockTimerInterval);
  const update = () => {
    const el = document.getElementById("lock-timer");
    if (!el) { clearInterval(lockTimerInterval); return; }
    el.textContent = formatDuration(Date.now() - startTs);
  };
  update();
  lockTimerInterval = setInterval(update, 1000);
}

function openLockModal() {
  $("#lock-reason-input").value = "";
  $("#lock-reason-error").classList.add("hidden");
  $("#modal-lock-start").classList.remove("hidden");
}
$("#btn-lock-cancel").addEventListener("click", () => $("#modal-lock-start").classList.add("hidden"));
$("#btn-lock-confirm").addEventListener("click", () => {
  const reason = $("#lock-reason-input").value.trim();
  if (!reason) { $("#lock-reason-error").classList.remove("hidden"); return; }
  const locks = [...(todayData.locks || []), { start: Date.now(), end: null, reason, justification: null }];
  saveToday({ locks });
  $("#modal-lock-start").classList.add("hidden");
  showToast("Horario bloqueado");
});

function openUnlockModal() {
  const lock = getActiveLock(todayData);
  if (!lock) return;
  $("#lock-end-reason").textContent = lock.reason || "—";
  $("#lock-end-duration").textContent = formatDuration(Date.now() - lock.start);
  $("#lock-justification").value = "";
  $("#lock-justification-error").classList.add("hidden");
  $("#modal-lock-end").classList.remove("hidden");
}
$("#btn-lock-end-cancel").addEventListener("click", () => $("#modal-lock-end").classList.add("hidden"));
$("#btn-lock-end-confirm").addEventListener("click", () => {
  const justification = $("#lock-justification").value.trim();
  if (!justification) { $("#lock-justification-error").classList.remove("hidden"); return; }
  const locks = [...(todayData.locks || [])];
  const idx = locks.length - 1;
  if (idx < 0) return;
  locks[idx] = { ...locks[idx], end: Date.now(), justification };
  saveToday({ locks });
  clearInterval(lockTimerInterval);
  $("#modal-lock-end").classList.add("hidden");
  showToast("Horario desbloqueado");
});

function toggleBlock(blockId, blocks, evt) {
  const b = blocks.find((x) => x.id === blockId);
  if (!b || b.isBreak) return;
  const current = (todayData.blocks && todayData.blocks[blockId]) || {};
  const completed = !current.completed;
  const update = {
    blocks: { ...(todayData.blocks || {}), [blockId]: { ...current, completed, completedAt: completed ? Date.now() : null } },
  };
  saveToday(update);
  if (completed) {
    const x = evt && typeof evt.clientX === "number" && evt.clientX ? evt.clientX : window.innerWidth / 2;
    const y = evt && typeof evt.clientY === "number" && evt.clientY ? evt.clientY : window.innerHeight / 2;
    triggerCompletionFX(x, y);
    playFxSound();
  }
}

// ---------- FX: efecto tipo maquinaria al completar un bloque ----------
function triggerCompletionFX(x, y) {
  const overlay = $("#fx-overlay");
  if (!overlay) return;
  overlay.innerHTML = "";
  overlay.style.setProperty("--fx-x", x + "px");
  overlay.style.setProperty("--fx-y", y + "px");

  const flash = document.createElement("div");
  flash.className = "fx-flash";
  overlay.appendChild(flash);

  const beam = document.createElement("div");
  beam.className = "fx-beam";
  beam.style.top = y + "px";
  overlay.appendChild(beam);

  const gearBig = document.createElement("div");
  gearBig.className = "fx-gear";
  gearBig.textContent = "⚙️";
  gearBig.style.left = x + "px";
  gearBig.style.top = y + "px";
  overlay.appendChild(gearBig);

  const gearSmall = document.createElement("div");
  gearSmall.className = "fx-gear small";
  gearSmall.textContent = "⚙️";
  gearSmall.style.left = (x + 22) + "px";
  gearSmall.style.top = (y - 18) + "px";
  overlay.appendChild(gearSmall);

  const N = 12;
  for (let i = 0; i < N; i++) {
    const s = document.createElement("div");
    s.className = "fx-spark";
    const angle = (Math.PI * 2 * i) / N + Math.random() * 0.3;
    const dist = 50 + Math.random() * 70;
    s.style.left = x + "px";
    s.style.top = y + "px";
    s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    s.style.setProperty("--dy", Math.sin(angle) * dist + 20 + "px"); // ligera caída, como chispas
    s.style.setProperty("--rot", (angle * 180) / Math.PI + 90 + "deg");
    overlay.appendChild(s);
  }

  const appEl = document.getElementById("app");
  if (appEl) {
    appEl.classList.remove("fx-shake");
    void appEl.offsetWidth; // reinicia la animación aunque se dispare seguido
    appEl.classList.add("fx-shake");
  }

  clearTimeout(triggerCompletionFX._t);
  triggerCompletionFX._t = setTimeout(() => { overlay.innerHTML = ""; }, 900);
}

function playFxSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Golpe grave, como una prensa/pistón industrial
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(160, now);
    thump.frequency.exponentialRampToValueAtTime(45, now + 0.18);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.24);

    // "Clank" metálico (ruido filtrado, como una pieza de metal)
    const bufferSize = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2600;
    bandpass.Q.value = 4;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.25, now + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now + 0.02);

    setTimeout(() => ctx.close(), 500);
  } catch (e) { /* audio no disponible, se ignora */ }
}

function openBlockModal(blockId, blocks) {
  const b = blocks.find((x) => x.id === blockId);
  if (!b) return;
  editingBlockId = blockId;
  const bd = (todayData.blocks && todayData.blocks[blockId]) || {};
  $("#modal-block-title").textContent = b.label;
  $("#modal-block-notes").value = bd.notes || "";
  const metricsWrap = $("#modal-block-metrics");
  metricsWrap.innerHTML = "";
  (b.metrics || []).forEach((m) => {
    const val = (bd.metrics && bd.metrics[m.key]) || "";
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <label class="text-xs text-gray-400">${m.label}</label>
      <input data-metric="${m.key}" type="${m.type}" min="0" value="${val}"
        class="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-600" />
    `;
    metricsWrap.appendChild(wrap);
  });
  $("#modal-block").classList.remove("hidden");
}
$("#btn-block-cancel").addEventListener("click", () => $("#modal-block").classList.add("hidden"));
$("#btn-block-save").addEventListener("click", () => {
  if (!editingBlockId) return;
  const notes = $("#modal-block-notes").value.trim();
  const metrics = {};
  $all("[data-metric]").forEach((el) => (metrics[el.dataset.metric] = el.value ? Number(el.value) : ""));
  const current = (todayData.blocks && todayData.blocks[editingBlockId]) || {};
  const update = { blocks: { ...(todayData.blocks || {}), [editingBlockId]: { ...current, notes, metrics } } };
  saveToday(update);
  $("#modal-block").classList.add("hidden");
  showToast("Guardado");
});

function saveToday(partial) {
  const today = new Date();
  const { type } = getBlocksForDate(today);
  const merged = { ...todayData, ...partial, dayType: type, updatedAt: Date.now() };
  const { blocks } = getEffectiveBlocksForDate(today, merged);
  const { points } = computeDayPoints(merged, blocks);
  merged.points = points;
  dayDocRef(today).set(merged, { merge: false }).catch((e) => showToast("Error al guardar: " + e.message));
}

// ---------- 9. Atender lead ----------
// El botón flotante (#btn-fab-lead) y sus modales se manejan en updateLeadFab()
// y en los handlers de "Atender lead (inicio / fin de llamada)" más arriba.

// ---------- 10. Racha (streak) ----------
async function computeStreak() {
  if (!currentUser) return;
  let streak = 0;
  let d = new Date();
  // si hoy aún no está completo, empieza a contar desde ayer
  const { type: todayType, blocks: todayBlocks } = getEffectiveBlocksForDate(d, todayData);
  const todayComplete = todayType !== "weekend" && computeDayPoints(todayData, todayBlocks).allDone;
  if (!todayComplete) d.setDate(d.getDate() - 1);
  else streak++;

  for (let i = 0; i < 60; i++) {
    const { type } = getBlocksForDate(d);
    if (type === "weekend") { d.setDate(d.getDate() - 1); continue; }
    try {
      const snap = await dayDocRef(d).get();
      if (!snap.exists) break;
      const { blocks } = getEffectiveBlocksForDate(d, snap.data());
      const { allDone } = computeDayPoints(snap.data(), blocks);
      if (!allDone) break;
      streak++;
    } catch (e) { break; }
    d.setDate(d.getDate() - 1);
  }
  $("#streak-count").textContent = `${streak}🔥`;
}

// ---------- 11. Tab Semana ----------
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Dom
  const diff = day === 0 ? -6 : 1 - day; // lunes como inicio
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function renderWeekTab() {
  if (!currentUser) return;
  const monday = startOfWeek(new Date());
  const days = [];
  for (let i = 0; i < 5; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); days.push(d); }

  const results = await Promise.all(
    days.map(async (d) => {
      let data = { blocks: {}, leadSessions: [], locks: [] };
      try {
        const snap = await dayDocRef(d).get();
        if (snap.exists) data = snap.data();
      } catch (e) { /* si falla la lectura, se queda el día vacío */ }
      if (!data.blocks) data.blocks = {};
      if (!data.leadSessions) data.leadSessions = [];
      const { type, blocks } = getEffectiveBlocksForDate(d, data);
      const realBlocks = blocks.filter((b) => !b.isBreak);
      const doneCount = realBlocks.filter((b) => data.blocks[b.id] && data.blocks[b.id].completed).length;
      const { points } = computeDayPoints(data, blocks);
      weekCache[dateStr(d)] = { date: d, type, blocks, data, points };
      return { date: d, type, total: realBlocks.length, done: doneCount, points, leadSessions: data.leadSessions };
    })
  );

  const wrap = $("#week-days");
  wrap.innerHTML = "";
  let totalDone = 0, totalBlocks = 0, totalPoints = 0, allLeads = [];
  results.forEach((r) => {
    totalDone += r.done; totalBlocks += r.total; totalPoints += r.points; allLeads = allLeads.concat(r.leadSessions);
    const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
    const isToday = dateStr(r.date) === dateStr(new Date());
    const row = document.createElement("div");
    row.className = `flex items-center justify-between bg-gray-900 rounded-xl p-3 cursor-pointer active:bg-gray-800 transition ${isToday ? "ring-1 ring-blue-600" : ""}`;
    row.dataset.date = dateStr(r.date);
    row.innerHTML = `
      <div>
        <p class="text-sm font-medium">${DIAS_ES[r.date.getDay()]}</p>
        <p class="text-[11px] text-gray-500">${dateStr(r.date)}${isToday ? " · hoy" : ""}</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div class="h-full bg-blue-600" style="width:${pct}%"></div>
        </div>
        <span class="text-xs text-gray-400 w-10 text-right">${pct}%</span>
        <span class="text-xs text-blue-400 w-14 text-right">${r.points} pts</span>
        <span class="text-gray-600 text-xs">›</span>
      </div>
    `;
    row.addEventListener("click", () => openDayDetail(row.dataset.date));
    wrap.appendChild(row);
  });

  const weekPct = totalBlocks ? Math.round((totalDone / totalBlocks) * 100) : 0;
  $("#week-adherence").textContent = `${weekPct}%`;
  $("#week-points").textContent = `${totalPoints} pts`;
  $("#week-leads-count").textContent = `${allLeads.length} leads`;
  const avgResponse = allLeads.length ? (allLeads.reduce((a, l) => a + (l.responseMinutes || 0), 0) / allLeads.length).toFixed(1) : "—";
  $("#week-leads-avg").textContent = allLeads.length ? `${avgResponse} min promedio de respuesta` : "— min promedio";
  const withDuration = allLeads.filter((l) => typeof l.durationMinutes === "number");
  const durEl = $("#week-leads-duration");
  if (durEl) {
    const avgDur = withDuration.length ? (withDuration.reduce((a, l) => a + l.durationMinutes, 0) / withDuration.length).toFixed(1) : "—";
    durEl.textContent = withDuration.length ? `${avgDur} min promedio de llamada` : "— min promedio de llamada";
  }
}

// ---------- Detalle de un día (al tocar una fila en Semana) ----------
function openDayDetail(ds) {
  const entry = weekCache[ds];
  if (!entry) return;
  renderDayDetailModal(entry);
  $("#modal-day-detail").classList.remove("hidden");
}

function renderDayDetailModal(entry) {
  const { date, type, blocks, data, points, titleOverride } = entry;
  $("#day-detail-title").textContent = titleOverride || `${DIAS_ES[date.getDay()]} · ${dateStr(date)}`;
  $("#day-detail-points").textContent = `${points} pts`;

  const list = $("#day-detail-list");
  list.innerHTML = "";

  if (blocks.length === 0) {
    list.innerHTML = `<p class="text-sm text-gray-500 text-center py-6">Sin bloques programados ese día.</p>`;
    return;
  }

  blocks.forEach((b) => {
    const bd = (data.blocks && data.blocks[b.id]) || {};
    const status = historicalStatus(b, bd, date, data);
    const metricSummary = b.metrics && bd.metrics
      ? b.metrics.map((m) => (bd.metrics[m.key] ? `${m.label.replace(/^# /, "")}: ${bd.metrics[m.key]}` : null)).filter(Boolean).join(" · ")
      : "";
    const leadSessionsForBlock = data.leadSessions || []; // interruptionBarHtml filtra por traslape de horario
    const locksForBlock = data.locks || [];
    const row = document.createElement("div");
    row.className = `status-${status} border-l-4 rounded-xl p-3`;
    row.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-medium ${b.isBreak ? "text-gray-400" : ""}">
          ${status === "done" ? "✓ " : status === "missed" ? "✕ " : ""}${escapeHtml(b.label)}
        </p>
        <span class="text-[10px] text-gray-500 shrink-0">${b.start}–${b.end}</span>
      </div>
      <p class="text-[11px] text-gray-500 mt-0.5">${STATUS_LABEL[status]}</p>
      ${metricSummary ? `<p class="text-[11px] text-blue-400 mt-0.5">${escapeHtml(metricSummary)}</p>` : ""}
      ${bd.notes ? `<p class="text-[11px] text-gray-400 mt-0.5 italic">"${escapeHtml(bd.notes)}"</p>` : ""}
      ${interruptionBarHtml(b, leadSessionsForBlock)}
      ${interruptionBarHtml(b, locksForBlock, LOCK_BAR_OPTS)}
    `;
    list.appendChild(row);
  });

  if (data.locks && data.locks.length) {
    const lockHeader = document.createElement("p");
    lockHeader.className = "text-xs text-gray-400 uppercase pt-2";
    lockHeader.textContent = "Bloqueos de horario";
    list.appendChild(lockHeader);
    data.locks.forEach((l) => {
      const dur = l.end ? formatDuration(l.end - l.start) : "en curso";
      const row = document.createElement("div");
      row.className = "border-l-4 border-violet-600 bg-violet-950/40 rounded-xl p-3";
      row.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-medium text-violet-200">🔒 ${escapeHtml(l.reason || "Sin motivo")}</p>
          <span class="text-[10px] text-gray-500 shrink-0">${dur}</span>
        </div>
        ${l.justification
          ? `<p class="text-[11px] text-gray-400 mt-1 italic">"${escapeHtml(l.justification)}"</p>`
          : `<p class="text-[11px] text-red-400 mt-1">Sin justificar todavía</p>`}
      `;
      list.appendChild(row);
    });
  }
}

$("#btn-day-detail-close").addEventListener("click", () => $("#modal-day-detail").classList.add("hidden"));

// ---------- Equipo (solo gerente): ver el día de cada vendedor ----------
async function renderEquipoTab() {
  if (!currentUser || !isManager()) return;
  const listEl = $("#equipo-list");
  const emptyEl = $("#equipo-empty");
  listEl.innerHTML = "";
  let members = [];
  try {
    const snap = await db.collection("teams").doc(TEAM_ID).collection("members").get();
    members = snap.docs.map((d) => d.data()).filter((m) => m.uid && m.uid !== currentUser.uid);
  } catch (e) {
    listEl.innerHTML = `<p class="text-sm text-red-400 text-center py-6">No se pudo cargar el equipo: ${escapeHtml(e.message)}</p>`;
    return;
  }
  emptyEl.classList.toggle("hidden", members.length > 0);
  if (!members.length) return;

  const today = new Date();
  const rows = await Promise.all(members.map(async (m) => {
    let data = { blocks: {}, leadSessions: [], locks: [] };
    try {
      const snap = await userDocRef(m.uid).collection("days").doc(dateStr(today)).get();
      if (snap.exists) data = snap.data();
    } catch (e) { /* si falla, se muestra sin datos */ }
    const { blocks } = getEffectiveBlocksForDate(today, data, m.scheduleId);
    const realBlocks = blocks.filter((b) => !b.isBreak);
    const doneCount = realBlocks.filter((b) => data.blocks && data.blocks[b.id] && data.blocks[b.id].completed).length;
    const { points } = computeDayPoints(data, blocks);
    return { member: m, total: realBlocks.length, done: doneCount, points };
  }));

  rows.forEach((r) => {
    const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "flex items-center justify-between bg-gray-900 rounded-xl p-3 cursor-pointer active:bg-gray-800 transition";
    row.innerHTML = `
      <div class="min-w-0">
        <p class="text-sm font-medium truncate">${escapeHtml(r.member.name || r.member.email || "Vendedor")}</p>
        <p class="text-[11px] text-gray-500">${(SCHEDULE_TEMPLATES[r.member.scheduleId] || {}).label || r.member.scheduleId}</p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div class="w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div class="h-full bg-blue-600" style="width:${pct}%"></div>
        </div>
        <span class="text-xs text-gray-400 w-10 text-right">${pct}%</span>
        <span class="text-xs text-blue-400 w-12 text-right">${r.points} pts</span>
        <span class="text-gray-600 text-xs">›</span>
      </div>
    `;
    row.addEventListener("click", () => openTeamMemberDetail(r.member));
    listEl.appendChild(row);
  });
}

async function openTeamMemberDetail(member) {
  const today = new Date();
  let data = { blocks: {}, leadSessions: [], locks: [] };
  try {
    const snap = await userDocRef(member.uid).collection("days").doc(dateStr(today)).get();
    if (snap.exists) data = snap.data();
  } catch (e) { showToast("No se pudo cargar: " + e.message); return; }
  if (!data.blocks) data.blocks = {};
  const { type, blocks } = getEffectiveBlocksForDate(today, data, member.scheduleId);
  const { points } = computeDayPoints(data, blocks);
  renderDayDetailModal({
    date: today, type, blocks, data, points,
    titleOverride: `${member.name || "Vendedor"} · Hoy`,
  });
  $("#modal-day-detail").classList.remove("hidden");
}

// ---------- 12. Tabs ----------
$all(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;
    $all(".tab-btn").forEach((b) => b.classList.remove("tab-active"));
    btn.classList.add("tab-active");
    $all(".tab-panel").forEach((p) => p.classList.add("hidden"));
    $(`#tab-${activeTab}`).classList.remove("hidden");
    if (activeTab === "semana") renderWeekTab();
    if (activeTab === "stats") renderStatsTab();
    if (activeTab === "leads") renderLeadsTab();
    if (activeTab === "equipo") renderEquipoTab();
  });
});

// ---------- Leads: gráficas y notas de la semana actual (lunes–domingo) ----------
// Nota: esto NO borra datos de Firestore, solo muestra la semana en curso —
// así el "Resumen" (14 días) y tu racha siguen funcionando con el historial completo.
async function renderLeadsTab() {
  if (!currentUser || typeof Chart === "undefined") return;
  const monday = startOfWeek(new Date());
  const weekDays = [];
  for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); weekDays.push(d); }

  const perDayCount = {}, perDayResponseAvg = {}, perDayDurationAvg = {};
  let allSessions = [];

  await Promise.all(weekDays.map(async (d) => {
    let data = { leadSessions: [] };
    try {
      const snap = await dayDocRef(d).get();
      if (snap.exists) data = snap.data();
    } catch (e) { /* día sin datos */ }
    const sessions = data.leadSessions || [];
    const dKey = dateStr(d);
    perDayCount[dKey] = sessions.length;
    const withResp = sessions.filter((s) => typeof s.responseMinutes === "number");
    perDayResponseAvg[dKey] = withResp.length ? withResp.reduce((a, s) => a + s.responseMinutes, 0) / withResp.length : 0;
    const withDur = sessions.filter((s) => typeof s.durationMinutes === "number");
    perDayDurationAvg[dKey] = withDur.length ? withDur.reduce((a, s) => a + s.durationMinutes, 0) / withDur.length : 0;
    sessions.forEach((s) => allSessions.push({ ...s, date: d }));
  }));

  const emptyEl = $("#leads-empty");
  if (emptyEl) emptyEl.classList.toggle("hidden", allSessions.length > 0);

  const dayLabels = weekDays.map((d) => DIAS_ES[d.getDay()].slice(0, 3));
  drawBar("chart-leads-count", dayLabels, weekDays.map((d) => perDayCount[dateStr(d)] || 0), "#f97316", false);
  drawBar("chart-leads-response", dayLabels, weekDays.map((d) => Math.round((perDayResponseAvg[dateStr(d)] || 0) * 10) / 10), "#2563eb", false);
  drawBar("chart-leads-duration", dayLabels, weekDays.map((d) => Math.round((perDayDurationAvg[dateStr(d)] || 0) * 10) / 10), "#7c3aed", false);

  allSessions.sort((a, b) => b.start - a.start);
  const listEl = $("#leads-notes-list");
  if (listEl) {
    listEl.innerHTML = "";
    allSessions.forEach((s) => {
      const dur = typeof s.durationMinutes === "number" ? `${s.durationMinutes} min` : "en curso";
      const row = document.createElement("div");
      row.className = "bg-gray-800 rounded-xl p-3";
      row.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-medium">${escapeHtml(s.name || "Sin nombre")}</p>
          <span class="text-[10px] text-gray-500 shrink-0">${DIAS_ES[s.date.getDay()].slice(0, 3)} ${s.date.getDate()}</span>
        </div>
        <p class="text-[11px] text-gray-500 mt-0.5">Respuesta: ${typeof s.responseMinutes === "number" ? s.responseMinutes : "—"} min · Duración: ${dur}</p>
        ${s.note ? `<p class="text-[11px] text-gray-500 mt-0.5">Nota inicial: "${escapeHtml(s.note)}"</p>` : ""}
        ${s.closingNote ? `<p class="text-[11px] text-gray-400 mt-0.5 italic">Resumen: "${escapeHtml(s.closingNote)}"</p>` : ""}
      `;
      listEl.appendChild(row);
    });
  }
}

// ---------- Resumen: gráficas al abrir la app ----------
let chartInstances = {};

async function renderStatsTab() {
  if (!currentUser || typeof Chart === "undefined") return;
  const days = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const { type } = getBlocksForDate(d);
    if (type === "weekend") continue;
    days.push({ date: d });
  }
  days.reverse(); // orden cronológico para la gráfica de tendencia por día

  let completed = 0, missed = 0, blocked = 0;
  const lockCountByDay = {};
  const lockCountByBlock = {};

  await Promise.all(days.map(async ({ date }) => {
    let data = { blocks: {}, locks: [] };
    try {
      const snap = await dayDocRef(date).get();
      if (snap.exists) data = snap.data();
    } catch (e) { /* si falla, se cuenta como día sin datos */ }
    if (!data.blocks) data.blocks = {};
    if (!data.locks) data.locks = [];
    const { blocks } = getEffectiveBlocksForDate(date, data);

    blocks.filter((b) => !b.isBreak).forEach((b) => {
      const bd = data.blocks[b.id] || {};
      const status = historicalStatus(b, bd, date, data);
      if (status === "done") completed++;
      else if (status === "missed") missed++;
      else if (status === "blocked") blocked++;
    });

    const dKey = dateStr(date);
    lockCountByDay[dKey] = data.locks.length;
    data.locks.forEach((l) => {
      const midMin = minutesFromTimestamp(l.start);
      const hitBlock = blocks.find((b) => !b.isBreak && toMinutes(b.start) <= midMin && midMin < toMinutes(b.end));
      const label = hitBlock ? hitBlock.label : "Fuera de bloques";
      lockCountByBlock[label] = (lockCountByBlock[label] || 0) + 1;
    });
  }));

  const totalLocks = Object.values(lockCountByDay).reduce((a, b) => a + b, 0);
  const hasData = completed + missed + blocked > 0 || totalLocks > 0;
  const emptyMsg = $("#stats-empty");
  if (emptyMsg) emptyMsg.classList.toggle("hidden", hasData);

  drawDoughnut("chart-completion", ["Completadas", "No completadas", "Bloqueadas"], [completed, missed, blocked], ["#16a34a", "#dc2626", "#7c3aed"]);

  const dayLabels = days.map(({ date }) => `${DIAS_ES[date.getDay()].slice(0, 3)} ${date.getDate()}`);
  const dayValues = days.map(({ date }) => lockCountByDay[dateStr(date)] || 0);
  drawBar("chart-locks-day", dayLabels, dayValues, "#7c3aed", false);

  const blockLabels = Object.keys(lockCountByBlock);
  const blockValues = Object.values(lockCountByBlock);
  drawBar("chart-locks-block", blockLabels.length ? blockLabels : ["Sin bloqueos todavía"], blockLabels.length ? blockValues : [0], "#f59e0b", true);
}

function themeChartColors() {
  const isLight = document.body.classList.contains("light");
  return { tick: isLight ? "#475569" : "#9ca3af", grid: isLight ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.06)" };
}

function drawDoughnut(canvasId, labels, data, colors) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  const { tick } = themeChartColors();
  chartInstances[canvasId] = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      plugins: { legend: { position: "bottom", labels: { color: tick, boxWidth: 10, font: { size: 10 } } } },
      cutout: "60%",
    },
  });
}

function drawBar(canvasId, labels, data, color, horizontal) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  const { tick, grid } = themeChartColors();
  chartInstances[canvasId] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 4 }] },
    options: {
      indexAxis: horizontal ? "y" : "x",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid }, beginAtZero: true },
        y: { ticks: { color: tick, font: { size: 10 } }, grid: { color: grid }, beginAtZero: true },
      },
    },
  });
}

// ---------- 13. Notificaciones locales ----------
let notifTimers = [];
$("#btn-notifications").addEventListener("click", async () => {
  if (!("Notification" in window)) return showToast("Este navegador no soporta notificaciones.");
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    localStorage.setItem("notifs_on", "1");
    scheduleTodayNotifications();
    $("#notif-status").textContent = "Recordatorios activados para hoy.";
    showToast("Recordatorios activados");
  } else {
    $("#notif-status").textContent = "Permiso de notificaciones denegado.";
  }
});

function scheduleTodayNotifications() {
  notifTimers.forEach((t) => clearTimeout(t));
  notifTimers = [];
  const now = new Date();
  const { blocks } = getEffectiveBlocksForDate(now, todayData);
  if (!blocks.length) return;
  const nowMin = minutesNow(now);
  blocks.filter((b) => !b.isBreak).forEach((b) => {
    const startMin = toMinutes(b.start);
    if (startMin <= nowMin) return;
    const msUntil = (startMin - nowMin) * 60 * 1000 - now.getSeconds() * 1000;
    const timer = setTimeout(() => fireNotification(b), msUntil);
    notifTimers.push(timer);
  });
}

function fireNotification(b) {
  const title = `Inicia: ${b.label}`;
  const body = `${b.start} – ${b.end}`;
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: "icons/icon-192.png", tag: b.id }));
  } else if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "icons/icon-192.png" });
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
  if (localStorage.getItem("notifs_on") === "1" && Notification.permission === "granted") {
    $("#notif-status").textContent = "Recordatorios activados para hoy.";
    scheduleTodayNotifications();
  }
}
