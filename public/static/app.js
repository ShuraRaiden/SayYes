// ===== YES or YES — страница девочки =====
// id приглашения берём из пути /d/{id}; данные грузим с бэкенда.
// Язык берём из приглашения (invite.lang); фоллбэк — ?lang=/язык браузера.
// Фоллбэк для локального превью без сервера: ?to=Anna&from=Alex&q=...&lang=en

const params = new URLSearchParams(location.search);
const pathId = (location.pathname.match(/\/d\/([^/?#]+)/) || [])[1];

const invite = {
  to:   null,
  from: null,
  q:    null,
  lang: I18N.norm(params.get("lang") || I18N.detect()),
  id:   pathId || params.get("id") || null,
  noPhrases: null,   // премиум: кастомные фразы NO от парня
};

function applyInvite() {
  const L = invite.lang;
  document.querySelectorAll(".to-name").forEach(el => {
    el.textContent = invite.to || I18N.t(L, "to_name_default");
  });
  document.querySelectorAll(".from-name").forEach(el => {
    el.textContent = invite.from || I18N.t(L, "from_name_default");
  });
  document.querySelector(".question-text").textContent =
    invite.q || I18N.t(L, "question_default");
}

// Применяем язык целиком (статика + имена/вопрос)
function applyLang() {
  I18N.apply(invite.lang);
  applyInvite();
  renderStep();   // обновить подписи кнопок анкеты под язык
}

async function loadInvite() {
  if (invite.id) {
    try {
      const r = await fetch(`/api/v1/invites/${encodeURIComponent(invite.id)}`);
      if (r.ok) {
        const data = await r.json();
        invite.to = data.to_name;
        invite.from = data.from_name;
        invite.q = data.question;
        invite.lang = I18N.norm(data.lang || invite.lang);
        invite.noPhrases = (data.no_phrases && data.no_phrases.length) ? data.no_phrases : null;
        applyLang();
        return;
      }
      if (r.status === 404) { showScreen("notfound"); return; }
    } catch (_) {
      // нет сети/сервера: для настоящей ссылки из пути — показываем «не найдено»
      if (pathId) { showScreen("notfound"); return; }
    }
  }
  // Фоллбэк: данные из query (демо-режим без сервера)
  invite.to = params.get("to") || invite.to;
  invite.from = params.get("from") || invite.from;
  invite.q = params.get("q") || invite.q;
  applyLang();
}

// ---------- Навигация по экранам ----------
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.toggle("is-active", s.dataset.screen === name);
  });
}

const answer = { say: null, place: null, when: null, note: "" };

// ===================================================================
//  Убегающая кнопка NO — РАСТЁТ, текст на ней + пузырёк-реакция сверху
//  Работает и мышью (наведение), и пальцем (касание убегает до клика)
// ===================================================================
const noWrap   = document.querySelector("[data-no-wrap]");
const noBtn    = document.querySelector('[data-action="no"]');
const bubble   = document.querySelector("[data-bubble]");
const yesBtn   = document.querySelector('[data-action="yes"]');

// Кнопка siempre es "NO". Текст меняется в облачке-сообщении ОТ НЕГО.
// Премиум: если парень задал свои фразы — используем их; иначе словарь по языку.
function noMessages() {
  if (invite.noPhrases && invite.noPhrases.length) return invite.noPhrases;
  return I18N.noMessages(invite.lang);
}

function setMessage(i) {
  const arr = noMessages();
  // Зацикливаем — облачко никогда не останавливается на одной фразе
  bubble.textContent = arr[((i % arr.length) + arr.length) % arr.length];
  bubble.classList.add("show");
  bubble.classList.remove("ping");
  void bubble.offsetWidth;          // рестарт анимации «пых»
  bubble.classList.add("ping");
}

let escapes  = 0;
let noScale  = 1;          // во сколько раз увеличена кнопка NO
const NO_BASE = 19;        // базовый font-size (px), совпадает с --no-base
const NO_MAX  = 2.6;       // предел роста

// iOS viewport-fit=cover: фикс-позиционированная кнопка/облачко могут заехать под
// «остров»/статус-бар сверху и home-indicator снизу. Меряем safe-area-insets один
// раз и держим весь блок «облако + кнопка» внутри безопасной зоны.
const SAFE = { top: 0, right: 0, bottom: 0, left: 0 };
(function measureSafeInsets() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);" +
    "padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  SAFE.top = parseFloat(cs.paddingTop) || 0;
  SAFE.right = parseFloat(cs.paddingRight) || 0;
  SAFE.bottom = parseFloat(cs.paddingBottom) || 0;
  SAFE.left = parseFloat(cs.paddingLeft) || 0;
  probe.remove();
})();

function overlaps(x, y, w, h, rect, m) {
  return !(x + w + m < rect.left || x - m > rect.right ||
           y + h + m < rect.top  || y - m > rect.bottom);
}

function moveNo() {
  escapes++;

  // Включаем «беглый» режим (fixed-позиционирование)
  noWrap.classList.add("is-running");

  // NO РАСТЁТ (через реальный font-size, чтобы offsetWidth был корректным).
  // Текст кнопки НЕ трогаем — всегда "NO".
  noScale = Math.min(NO_MAX, noScale + 0.14);
  noBtn.style.fontSize = `${NO_BASE * noScale}px`;

  // Сообщение ставим ДО позиционирования: тогда можно измерить реальный размер
  // облачка и обойти YES целиком — облачко висит НАД кнопкой и тоже не должно
  // на неё наезжать (это и был баг: обходили только прямоугольник кнопки).
  setMessage(escapes - 1);

  // Реальные размеры обёртки и облачка после изменения шрифта/текста.
  // bubbleH с БЕЗОПАСНЫМ фоллбэком: если замер не удался (0) — лучше пере-, чем
  // недозаложить место сверху, иначе облачко наедет на YES после дорисовки.
  const w = noWrap.offsetWidth;
  const h = noWrap.offsetHeight;
  const bubbleW = bubble.offsetWidth  || w;
  const bubbleH = bubble.offsetHeight || 64;

  const pad = 14;
  const gap = 14;                            // отступ облачка от кнопки (CSS: bottom 100% + 14px)
  const reserve = bubbleH + gap + 6;         // место, которое облачко занимает НАД кнопкой (+хвостик)
  const halfW   = Math.max(w, bubbleW) / 2;  // полуширина блока «кнопка+облако» (облако центрировано)
  const W = window.innerWidth;
  const H = window.innerHeight;
  const margin = 18;                         // воздух вокруг YES

  // Диапазоны так, чтобы ВЕСЬ блок (облако сверху + кнопка) влезал на экран.
  // max(...) гарантирует непустой диапазон даже на крошечном вьюпорте.
  const cxMin = pad + SAFE.left + halfW;
  const cxMax = Math.max(cxMin, W - pad - SAFE.right - halfW);
  const yMin  = pad + SAFE.top + reserve;            // верх облачка ниже «острова»/статус-бара
  const yMax  = Math.max(yMin, H - pad - SAFE.bottom - h); // низ кнопки выше home-indicator

  // Наезжает ли блок «облако + кнопка» (центр cxc, верх кнопки yc) на YES
  const yesRect = yesBtn.getBoundingClientRect();
  const hitsYes = (cxc, yc) =>
    overlaps(cxc - halfW, yc - reserve, halfW * 2, reserve + h, yesRect, margin);

  // Прыгаем в случайную точку, избегая зону YES целиком
  let cx = cxMin, y = yMin, placed = false;
  for (let tries = 0; tries < 24 && !placed; tries++) {
    cx = cxMin + Math.random() * (cxMax - cxMin);
    y  = yMin  + Math.random() * (yMax  - yMin);
    if (!hitsYes(cx, y)) placed = true;
  }
  if (!placed) {
    // Детерминированный фолбэк: уводим кластер в свободную полосу ОТНОСИТЕЛЬНО YES —
    // целиком под ним или над ним. Тогда наезда нет при любом горизонтальном cx.
    const below = yesRect.bottom + margin + reserve;  // верх облачка ниже YES
    const above = yesRect.top - margin - h;           // низ кнопки выше YES
    if (below <= yMax)      y = below;                 // ставим ПОД YES
    else if (above >= yMin) y = above;                 // ...или НАД YES
    else                    y = yMax;                  // места нет — лучшее усилие
    cx = (yesRect.left + yesRect.right) / 2 < W / 2 ? cxMax : cxMin;
  }
  cx = Math.min(Math.max(cx, cxMin), cxMax);           // финальный зажим в экран

  noWrap.style.left = `${cx - w / 2}px`;
  noWrap.style.top  = `${y}px`;

  yesBtn.classList.add("glow");
}

// Вход на экран вопроса: облачко скрыто, кнопка NO ещё без подписи
function initQuestion() {
  escapes = 0;
  noScale = 1;
  noBtn.style.fontSize = `${NO_BASE}px`;
  noWrap.classList.remove("is-running");
  noWrap.style.left = "";
  noWrap.style.top = "";
  bubble.classList.remove("show", "ping");
  yesBtn.classList.add("glow");
}

// Убегаем по НАЖАТИЮ/ТАПУ — так очевиднее: нажал, а кнопка увернулась.
// pointerdown ловит и мышь, и палец, и стилус — единый механизм для ПК и телефона.
noBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); moveNo(); });
// Подстраховка: если клик всё-таки дошёл — просто блокируем (NO нажать нельзя)
noBtn.addEventListener("click", (e) => e.preventDefault());

// ---------- Кнопка «Да» ----------
yesBtn.addEventListener("click", () => {
  answer.say = "YES";
  // Счётчик побегов NO (escapes) уходит парню в письмо при отправке ответа.
  celebrate();
  showScreen("celebrate");
});

function celebrate() {
  if (typeof confetti !== "function") return;
  const colors = ["#EE5B36", "#F4C24A", "#2FB4A8", "#1C1611", "#FFFCF4"];
  // Эмодзи-стикеры в брызгах (если движок поддерживает shapeFromText)
  let shapes;
  try {
    shapes = ["🎉", "💖", "✨", "🌟"].map(t => confetti.shapeFromText({ text: t, scalar: 2.2 }));
  } catch (_) { shapes = undefined; }

  const end = Date.now() + 1300;
  (function frame() {
    confetti({ particleCount: 4, angle: 60,  spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 110, spread: 95, origin: { y: 0.6 }, colors });
  if (shapes) confetti({ particleCount: 22, spread: 110, scalar: 2.2, shapes, origin: { y: 0.55 } });
}

// ---------- Навигация между экранами ----------
document.querySelector('[data-action="go-question"]')
  .addEventListener("click", () => { showScreen("question"); initQuestion(); });
// Если страница открыта сразу на экране вопроса
if (document.querySelector('.screen--question').classList.contains("is-active")) initQuestion();
document.querySelector('[data-action="go-survey"]')
  .addEventListener("click", () => { showScreen("survey"); renderStep(); });

// ===================================================================
//  Анкета (мультишаговая)
// ===================================================================
const STEPS = ["place", "when", "note"];
let stepIdx = 0;
const progressBar = document.querySelector("[data-progress]");

function renderStep() {
  document.querySelectorAll(".step").forEach(s => {
    s.classList.toggle("is-active", s.dataset.step === STEPS[stepIdx]);
  });
  progressBar.style.width = `${((stepIdx + 1) / STEPS.length) * 100}%`;
  document.querySelector('[data-action="step-back"]').style.visibility = stepIdx === 0 ? "hidden" : "visible";
  document.querySelector('[data-action="step-next"]').textContent =
    stepIdx === STEPS.length - 1 ? I18N.t(invite.lang, "g_send") : I18N.t(invite.lang, "g_next");
}

document.querySelectorAll("[data-choices]").forEach(group => {
  const field = group.dataset.choices;
  group.querySelectorAll(".choice").forEach(choice => {
    choice.addEventListener("click", () => {
      group.querySelectorAll(".choice").forEach(c => c.classList.remove("is-selected"));
      choice.classList.add("is-selected");
      answer[field] = choice.dataset.value;
      const custom = document.querySelector(`[data-custom="${field}"]`);
      if (custom && custom.type === "text") custom.value = "";
    });
  });
});

document.querySelectorAll("[data-custom]").forEach(input => {
  input.addEventListener("input", () => {
    const field = input.dataset.custom;
    if (input.value.trim()) {
      answer[field] = input.value.trim();
      const group = document.querySelector(`[data-choices="${field}"]`);
      group.querySelectorAll(".choice").forEach(c => c.classList.remove("is-selected"));
    }
  });
});

const noteInput = document.querySelector("[data-note]");
noteInput.addEventListener("input", () => { answer.note = noteInput.value.trim(); });

document.querySelector('[data-action="step-back"]').addEventListener("click", () => {
  if (stepIdx > 0) { stepIdx--; renderStep(); }
});
document.querySelector('[data-action="step-next"]').addEventListener("click", () => {
  const field = STEPS[stepIdx];
  if ((field === "place" || field === "when") && !answer[field]) { reactionShake(); return; }
  if (stepIdx < STEPS.length - 1) { stepIdx++; renderStep(); }
  else { submitAnswer(); }
});

function reactionShake() {
  const card = document.querySelector(".screen--survey .card");
  card.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-8px)" },
     { transform: "translateX(8px)" }, { transform: "translateX(0)" }],
    { duration: 260 }
  );
}

// ===================================================================
//  Отправка ответа на бэкенд (он сохранит и пришлёт письмо парню)
// ===================================================================
async function submitAnswer() {
  const L = invite.lang;
  // Показываем «спасибо» сразу — не заставляем девочку ждать сеть
  const summary = document.querySelector("[data-summary]");
  summary.innerHTML = `
    <div>📍 ${I18N.t(L, "g_sum_where")}: <b>${answer.place || "—"}</b></div>
    <div>🗓️ ${I18N.t(L, "g_sum_when")}: <b>${answer.when || "—"}</b></div>
    ${answer.note ? `<div>💬 «${answer.note}»</div>` : ""}
  `;
  showScreen("thanks");
  celebrate();

  if (!invite.id) return; // демо-режим без сервера — просто показали ответ
  try {
    await fetch(`/api/v1/invites/${encodeURIComponent(invite.id)}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        say: answer.say || "YES",
        place: answer.place,
        when: answer.when,
        note: answer.note,
        no_escapes: Math.min(escapes, 9999),
      }),
    });
  } catch (_) { /* не удалось отправить — ответ уже показан девочке */ }
}

// ---------- Старт ----------
applyLang();   // мгновенно локализуем статику под best-guess язык
loadInvite();  // затем уточняем язык/данные из приглашения
