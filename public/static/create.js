// ===== Сторона парня: форма → создаёт приглашение на бэкенде → ссылка =====

const $ = (sel) => document.querySelector(sel);

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s =>
    s.classList.toggle("is-active", s.dataset.screen === name));
  window.scrollTo(0, 0);
}

// ---------- Язык ----------
let lang;
try { lang = localStorage.getItem("yoy_lang"); } catch (_) {}
lang = I18N.norm(lang || I18N.detect());

// Наполняем селектор языками (каждый — на своём языке)
const langSel = $("#f-lang");
I18N.SUPPORTED.forEach(code => {
  const opt = document.createElement("option");
  opt.value = code;
  opt.textContent = I18N.LANG_NAMES[code];
  langSel.appendChild(opt);
});
langSel.value = lang;

function applyLang() { I18N.apply(lang); }

langSel.addEventListener("change", () => {
  lang = I18N.norm(langSel.value);
  try { localStorage.setItem("yoy_lang", lang); } catch (_) {}
  applyLang();
});

applyLang(); // локализуем форму под стартовый язык

// Подставить ранее введённые имя/почту (удобство)
try {
  $("#f-from").value  = localStorage.getItem("yoy_from")  || "";
  $("#f-email").value = localStorage.getItem("yoy_email") || "";
} catch (_) {}

// При фокусе на поле браузер подскролливает только само поле, и кнопка
// «Создать» под ним остаётся за нижним краем экрана/клавиатуры. Доводим
// скролл сами: поле — к центру, тогда видно и кнопку. Таймаут — ждём
// анимацию появления клавиатуры, иначе замер видимости врёт.
const submitBtn = $("#createForm button[type=submit]");
$("#createForm").addEventListener("focusin", (e) => {
  const field = e.target;
  if (!field.matches("input, select, textarea")) return;
  setTimeout(() => {
    if (document.activeElement !== field) return;
    const vv = window.visualViewport;
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    if (submitBtn.getBoundingClientRect().bottom <= visibleBottom) return;
    field.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 300);
});

let lastUrl = "";
let lastText = "";

$("#createForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const to    = $("#f-to").value.trim();
  const from  = $("#f-from").value.trim();
  const q     = $("#f-q").value.trim();
  const email = $("#f-email").value.trim();
  if (!to || !from || !email) return;

  // Премиум: свои фразы на кнопке NO — по одной в строке, чистим пустые
  const noPhrases = ($("#f-no").value || "")
    .split("\n").map(s => s.trim()).filter(Boolean).slice(0, 12);

  try {
    localStorage.setItem("yoy_from", from);
    localStorage.setItem("yoy_email", email);
    localStorage.setItem("yoy_lang", lang);
  } catch (_) {}

  const btn = $("#createForm button[type=submit]");
  btn.disabled = true;
  btn.textContent = I18N.t(lang, "c_creating");

  try {
    const r = await fetch("/api/v1/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_name: to,
        from_name: from,
        question: q || I18N.t(lang, "question_default"),
        owner_email: email,
        lang: lang,
        no_phrases: noPhrases.length ? noPhrases : null,
      }),
    });
    if (!r.ok) throw new Error("bad status " + r.status);
    const data = await r.json();
    lastUrl = data.url;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = I18N.t(lang, "c_submit");
    alert(I18N.t(lang, "c_error"));
    return;
  }
  btn.disabled = false;
  btn.textContent = I18N.t(lang, "c_submit");

  lastText = I18N.t(lang, "c_share_text").replace("{from}", from);

  $("#linkField").value = lastUrl;
  $("#done-to").textContent = to;
  $("#previewLink").href = lastUrl;
  $("#shareTg").href = `https://t.me/share/url?url=${encodeURIComponent(lastUrl)}&text=${encodeURIComponent(lastText)}`;
  $("#shareWa").href = `https://wa.me/?text=${encodeURIComponent(lastText + " " + lastUrl)}`;

  const recap = $("#recap");
  recap.textContent = I18N.t(lang, "c_recap").replace("{email}", email);
  recap.hidden = false;

  if (navigator.share) $("#shareNative").hidden = false;

  showScreen("done");
});

// Копирование ссылки
$("#copyBtn").addEventListener("click", async () => {
  const field = $("#linkField");
  const btn = $("#copyBtn");
  let ok = false;
  try {
    await navigator.clipboard.writeText(lastUrl);
    ok = true;
  } catch (_) {
    field.removeAttribute("readonly");
    field.select();
    field.setSelectionRange(0, 99999);
    try { ok = document.execCommand("copy"); } catch (_) {}
    field.setAttribute("readonly", "");
    // Снимаем выделение и фокус с поля — иначе на iOS остаются «ручки»/рамка
    // выделения вокруг инпута и после копирования.
    field.setSelectionRange(0, 0);
    field.blur();
    if (window.getSelection) window.getSelection().removeAllRanges();
  }
  // Снимаем фокус с кнопки — иначе вокруг неё висит фокус-обводка (Brave/iOS).
  btn.blur();
  btn.textContent = ok ? I18N.t(lang, "c_copied") : I18N.t(lang, "c_copy_fail");
  setTimeout(() => (btn.textContent = I18N.t(lang, "c_copy")), 1600);
});

// Нативный шеринг
$("#shareNative").addEventListener("click", async () => {
  try { await navigator.share({ title: "💌", text: lastText, url: lastUrl }); }
  catch (_) {}
});

// Создать другую
$("#againBtn").addEventListener("click", () => {
  $("#f-to").value = "";
  $("#f-q").value = "";
  $("#f-no").value = "";
  showScreen("form");
  $("#f-to").focus();
});
