/* ============================================================
   SEGUIMIENTO DE RUTINA — lógica de la app
   ============================================================ */

// ---------- 1. Definición de la rutina (bloques del día) ----------
const BLOCKS_WEEKDAY = [
  { id: "reporte",     label: "Reporte diario CRM",              start: "10:00", end: "10:20" },
  { id: "reactivacion",label: "Reactivación de clientes",         start: "10:20", end: "11:50",
    metrics: [{ key: "llamadas", label: "# Llamadas de reactivación", type: "number" }] },
  { id: "crm_embudo",  label: "Seguimientos CRM + Embudo",        start: "11:50", end: "14:00",
    metrics: [{ key: "leads_revisados", label: "# Leads revisados", type: "number" }] },
  { id: "comida",      label: "Comida",                           start: "14:00", end: "15:00", isBreak: true },
  { id: "cambaceo",    label: "Cambaceo / Prospección",           start: "15:00", end: "16:00",
    metrics: [{ key: "llamadas_cambaceo", label: "# Llamadas de cambaceo", type: "number" }] },
  { id: "mapeo_ia",    label: "Mapeo de empresas con IA",         start: "16:00", end: "17:00",
    metrics: [{ key: "empresas_mapeadas", label: "# Empresas mapeadas", type: "number" }] },
  { id: "metricas",    label: "Revisión de métricas",             start: "17:00", end: "17:30" },
  { id: "asesoria",    label: "Asesoría a vendedores",            start: "17:30", end: "18:00" },
];

const BLOCKS_FRIDAY = [
  { id: "reporte",     label: "Reporte diario CRM",              start: "10:00", end: "10:20" },
  { id: "reactivacion",label: "Reactivación de clientes",         start: "10:20", end: "11:50",
    metrics: [{ key: "llamadas", label: "# Llamadas de reactivación", type: "number" }] },
  { id: "crm_embudo",  label: "Seguimientos CRM + Embudo",        start: "11:50", end: "14:00",
    metrics: [{ key: "leads_revisados", label: "# Leads revisados", type: "number" }] },
  { id: "comida",      label: "Comida",                           start: "14:00", end: "15:00", isBreak: true },
  { id: "junta_metricas", label: "Junta: revisión de métricas",   start: "15:00", end: "15:30" },
  { id: "junta",       label: "Junta de equipo",                  start: "15:30", end: "18:00" },
];

const DIAS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function getBlocksForDate(date) {
  const day = date.getDay(); // 0 Dom - 6 Sab
  if (day >= 1 && day <= 4) return { type: "weekday", blocks: BLOCKS_WEEKDAY };
  if (day === 5) return { type: "friday", blocks: BLOCKS_FRIDAY };
  return { type: "weekend", blocks: [] };
}

function dateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function minutesNow(d) { return d.getHours() * 60 + d.getMinutes(); }
function toMinutes(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }

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
let todayData = { blocks: {}, leadLogs: [] };
let todayUnsub = null;
let activeTab = "hoy";
let editingBlockId = null;

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

// ---------- 5. Autenticación ----------
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
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
  } catch (e) { showAuthError(traduceError(e)); }
});
$("#btn-signout").addEventListener("click", () => auth.signOut());

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
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    if (user) {
      $("#auth-screen").classList.add("hidden");
      $("#main-app").classList.remove("hidden");
      $("#btn-fab-lead").classList.remove("hidden");
      $("#settings-email").textContent = user.email;
      initTodayListener();
      renderWeekTab();
      registerServiceWorker();
    } else {
      $("#auth-screen").classList.remove("hidden");
      $("#main-app").classList.add("hidden");
      $("#btn-fab-lead").classList.add("hidden");
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
    todayData = snap.exists ? snap.data() : { blocks: {}, leadLogs: [] };
    if (!todayData.blocks) todayData.blocks = {};
    if (!todayData.leadLogs) todayData.leadLogs = [];
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
    } else {
      allDone = false;
    }
  });
  if (allDone) points += 25;
  (data.leadLogs || []).forEach((l) => {
    points += 10;
    if (typeof l.minutes === "number" && l.minutes <= 15) points += 10;
  });
  return { points, allDone };
}

// ---------- 8. Render tab Hoy ----------
function blockStatus(b, bd, nowMin) {
  if (b.isBreak) return "break";
  if (bd && bd.completed) return "done";
  const s = toMinutes(b.start), e = toMinutes(b.end);
  if (nowMin < s) return "upcoming";
  if (nowMin >= s && nowMin <= e) return "current";
  return "missed";
}
const STATUS_LABEL = { done: "Completado", current: "En curso", missed: "Pendiente (venció)", upcoming: "Próximo", break: "Descanso" };

function renderToday() {
  const now = new Date();
  const { type, blocks } = getBlocksForDate(now);
  $("#today-label").textContent = `${DIAS_ES[now.getDay()]} · ${dateStr(now)}`;
  $("#today-title").textContent = type === "weekend" ? "Sin rutina hoy" : "Rutina de hoy";

  const nowMin = minutesNow(now);
  const container = $("#tab-hoy");
  container.innerHTML = "";

  if (type === "weekend") {
    container.innerHTML = `<div class="text-center text-gray-500 text-sm py-16">Hoy no tienes bloques programados. Buen descanso. 🙌</div>`;
    $("#points-today").textContent = "0";
    return;
  }

  blocks.forEach((b) => {
    const bd = (todayData.blocks && todayData.blocks[b.id]) || {};
    const status = blockStatus(b, bd, nowMin);
    const card = document.createElement("div");
    card.className = `status-${status} border-l-4 rounded-xl p-3 flex items-start gap-3 fade-in`;

    const hasMetrics = b.metrics && b.metrics.length > 0;
    const metricSummary = hasMetrics && bd.metrics
      ? b.metrics.map((m) => (bd.metrics[m.key] ? `${m.label.replace(/^# /,"")}: ${bd.metrics[m.key]}` : null)).filter(Boolean).join(" · ")
      : "";

    card.innerHTML = `
      <button data-toggle="${b.id}" class="mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 ${b.isBreak ? "border-gray-600" : "border-gray-500"} flex items-center justify-center ${bd.completed ? "bg-green-600 border-green-600" : ""}">
        ${bd.completed ? '<span class="text-xs">✓</span>' : ""}
      </button>
      <div class="flex-1 min-w-0" data-open="${b.id}">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-medium ${b.isBreak ? "text-gray-400" : ""}">${b.label}</p>
          <span class="text-[10px] text-gray-500 shrink-0">${b.start}–${b.end}</span>
        </div>
        <p class="text-[11px] text-gray-500 mt-0.5">${STATUS_LABEL[status]}${bd.notes ? " · con notas" : ""}</p>
        ${metricSummary ? `<p class="text-[11px] text-blue-400 mt-0.5">${metricSummary}</p>` : ""}
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-toggle]").forEach((el) =>
    el.addEventListener("click", () => toggleBlock(el.dataset.toggle, blocks))
  );
  container.querySelectorAll("[data-open]").forEach((el) =>
    el.addEventListener("click", () => openBlockModal(el.dataset.open, blocks))
  );

  const { points } = computeDayPoints(todayData, blocks);
  $("#points-today").textContent = points;
}

function toggleBlock(blockId, blocks) {
  const b = blocks.find((x) => x.id === blockId);
  if (!b || b.isBreak) return;
  const current = (todayData.blocks && todayData.blocks[blockId]) || {};
  const completed = !current.completed;
  const update = {
    blocks: { ...(todayData.blocks || {}), [blockId]: { ...current, completed, completedAt: completed ? Date.now() : null } },
  };
  saveToday(update);
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
  const { type, blocks } = getBlocksForDate(today);
  const merged = { ...todayData, ...partial, dayType: type, updatedAt: Date.now() };
  const { points } = computeDayPoints(merged, blocks);
  merged.points = points;
  dayDocRef(today).set(merged, { merge: false }).catch((e) => showToast("Error al guardar: " + e.message));
}

// ---------- 9. Registrar lead atendido ----------
$("#btn-fab-lead").addEventListener("click", () => {
  $("#lead-minutes").value = "";
  $("#lead-note").value = "";
  $("#modal-lead").classList.remove("hidden");
});
$("#btn-lead-cancel").addEventListener("click", () => $("#modal-lead").classList.add("hidden"));
$("#btn-lead-save").addEventListener("click", () => {
  const minutes = Number($("#lead-minutes").value || 0);
  const note = $("#lead-note").value.trim();
  const log = { minutes, note, time: Date.now() };
  const leadLogs = [...(todayData.leadLogs || []), log];
  saveToday({ leadLogs });
  $("#modal-lead").classList.add("hidden");
  showToast("Lead registrado");
});

// ---------- 10. Racha (streak) ----------
async function computeStreak() {
  if (!currentUser) return;
  let streak = 0;
  let d = new Date();
  // si hoy aún no está completo, empieza a contar desde ayer
  const { type: todayType, blocks: todayBlocks } = getBlocksForDate(d);
  const todayComplete = todayType !== "weekend" && computeDayPoints(todayData, todayBlocks).allDone;
  if (!todayComplete) d.setDate(d.getDate() - 1);
  else streak++;

  for (let i = 0; i < 60; i++) {
    const { type, blocks } = getBlocksForDate(d);
    if (type === "weekend") { d.setDate(d.getDate() - 1); continue; }
    try {
      const snap = await dayDocRef(d).get();
      if (!snap.exists) break;
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
      const { type, blocks } = getBlocksForDate(d);
      try {
        const snap = await dayDocRef(d).get();
        const data = snap.exists ? snap.data() : { blocks: {}, leadLogs: [] };
        const realBlocks = blocks.filter((b) => !b.isBreak);
        const doneCount = realBlocks.filter((b) => data.blocks && data.blocks[b.id] && data.blocks[b.id].completed).length;
        const { points } = computeDayPoints(data, blocks);
        return { date: d, type, total: realBlocks.length, done: doneCount, points, leadLogs: data.leadLogs || [] };
      } catch (e) {
        return { date: d, type, total: blocks.filter((b) => !b.isBreak).length, done: 0, points: 0, leadLogs: [] };
      }
    })
  );

  const wrap = $("#week-days");
  wrap.innerHTML = "";
  let totalDone = 0, totalBlocks = 0, totalPoints = 0, allLeads = [];
  results.forEach((r) => {
    totalDone += r.done; totalBlocks += r.total; totalPoints += r.points; allLeads = allLeads.concat(r.leadLogs);
    const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
    const isToday = dateStr(r.date) === dateStr(new Date());
    const row = document.createElement("div");
    row.className = `flex items-center justify-between bg-gray-900 rounded-xl p-3 ${isToday ? "ring-1 ring-blue-600" : ""}`;
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
      </div>
    `;
    wrap.appendChild(row);
  });

  const weekPct = totalBlocks ? Math.round((totalDone / totalBlocks) * 100) : 0;
  $("#week-adherence").textContent = `${weekPct}%`;
  $("#week-points").textContent = `${totalPoints} pts`;
  $("#week-leads-count").textContent = `${allLeads.length} leads`;
  const avg = allLeads.length ? (allLeads.reduce((a, l) => a + (l.minutes || 0), 0) / allLeads.length).toFixed(1) : "—";
  $("#week-leads-avg").textContent = allLeads.length ? `${avg} min promedio de respuesta` : "— min promedio";
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
  });
});

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
  const { type, blocks } = getBlocksForDate(now);
  if (type === "weekend") return;
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
