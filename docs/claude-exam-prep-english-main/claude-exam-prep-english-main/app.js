/* Treino de Inglês CCAR-F — exercícios de múltipla escolha sobre os termos em inglês do exame.
   Sem dependências. Progresso (pontuação por lição e termos a revisar) salvo em localStorage. */
(function () {
  "use strict";

  const DATA = window.GLOSSARY;
  const TERMS = Object.fromEntries(DATA.terms.map((t) => [t.id, t]));
  const STORE_KEY = "ccarf-trainer.v1";
  const GOOD = 90; // % a partir do qual a lição é considerada dominada
  const OK = 70;   // % a partir do qual vale só revisar, sem refazer

  // ---------- tema (claro / escuro / automático) ----------
  const THEME_KEY = "ccarf-theme";
  function applyTheme(choice) {
    const root = document.documentElement;
    if (choice === "light" || choice === "dark") root.setAttribute("data-theme", choice);
    else root.removeAttribute("data-theme");
    document.querySelectorAll("[data-theme-choice]").forEach((b) => b.classList.toggle("active", b.dataset.themeChoice === (choice || "auto")));
    try { localStorage.setItem(THEME_KEY, choice || "auto"); } catch (e) { /* ignora */ }
  }
  (function initTheme() {
    let saved = "auto";
    try { saved = localStorage.getItem(THEME_KEY) || "auto"; } catch (e) { /* ignora */ }
    applyTheme(saved);
    document.querySelectorAll("[data-theme-choice]").forEach((b) => b.addEventListener("click", () => applyTheme(b.dataset.themeChoice)));
  })();

  // ---------- estado persistente ----------
  const defaultState = () => ({
    done: {},        // lessonId -> { times, best, last }
    review: {},      // termId -> vezes que ainda precisa acertar
    settings: { typing: false },
  });
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* armazenamento indisponível */ }
    return defaultState();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
  }

  // ---------- utilidades ----------
  const $ = (sel) => document.querySelector(sel);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[`"'“”‘’]/g, "").replace(/\s+/g, " ").trim();
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const unitOf = (id) => DATA.units.find((u) => u.id === id);
  const termsOfUnit = (uid) => DATA.terms.filter((t) => t.unit === uid);
  const lessonOfTerm = (tid) => {
    for (const u of DATA.units) for (const l of u.lessons) if (l.terms.includes(tid)) return { unit: u, lesson: l };
    return null;
  };

  // Distratores: mesma unidade primeiro, depois global; nunca com a mesma tradução/termo.
  function distractors(term, field, n, poolUnit) {
    const seen = new Set([norm(term[field])]);
    const out = [];
    const take = (list) => {
      for (const t of shuffle(list)) {
        if (out.length >= n) break;
        if (t.id === term.id) continue;
        const key = norm(t[field]);
        if (!key || seen.has(key)) continue;
        seen.add(key); out.push(t);
      }
    };
    take(termsOfUnit(poolUnit || term.unit));
    if (out.length < n) take(DATA.terms);
    return out;
  }

  // ---------- geração de exercícios ----------
  function buildExercises(lesson, opts) {
    const terms = lesson.terms.map((id) => TERMS[id]);
    const unit = opts.unitId;
    const ex = [];

    if (lesson.principles) {
      lesson.principles.forEach((idx, i) => {
        const p = DATA.principles[idx];
        const term = terms.find((t) => norm(t.enPlain) === norm(p.en)) || terms[i];
        const isTrap = Math.random() < 0.5;
        ex.push({ kind: "trap", principle: p, term, statement: isTrap ? p.trap : p.correct, answer: isTrap ? "trap" : "correct" });
        ex.push(mcEnPt(term, unit));
      });
      return finalize(ex, terms);
    }

    for (const t of terms) {
      const kinds = ["mc_en_pt", "mc_pt_en"];
      if (t.exBlank) kinds.push("context", "context");
      if (opts.typing && t.typeable) kinds.push("type", "type");
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      if (kind === "mc_en_pt") ex.push(mcEnPt(t, unit));
      else if (kind === "mc_pt_en") ex.push(mcPtEn(t, unit));
      else if (kind === "context") ex.push(contextEx(t, unit));
      else ex.push({ kind: "type", term: t });
    }
    return finalize(ex, terms);
  }
  function finalize(ex, terms) {
    const list = shuffle(ex);
    if (terms.length >= 5) {
      const n = terms.length >= 10 ? 2 : 1;
      const pool = shuffle(terms);
      for (let i = 0; i < n; i++) {
        const pairs = pool.slice(i * 5, i * 5 + 5);
        if (pairs.length === 5) {
          const pos = Math.min(list.length, 3 + Math.floor(Math.random() * Math.max(1, list.length - 3)));
          list.splice(pos, 0, { kind: "match", pairs });
        }
      }
    }
    return list;
  }
  const mcEnPt = (t, unit) => ({ kind: "mc_en_pt", term: t, options: shuffle([t, ...distractors(t, "pt", 3, unit)]) });
  const mcPtEn = (t, unit) => ({ kind: "mc_pt_en", term: t, options: shuffle([t, ...distractors(t, "enPlain", 3, unit)]) });
  const contextEx = (t, unit) => ({ kind: "context", term: t, options: shuffle([t, ...distractors(t, "enPlain", 3, unit)]) });

  // ---------- telas ----------
  const screens = { home: $("#screen-home"), lesson: $("#screen-lesson"), result: $("#screen-result") };
  function show(name) {
    for (const k in screens) screens[k].classList.toggle("hidden", k !== name);
    window.scrollTo(0, 0);
  }

  // ---------- início ----------
  function renderHome() {
    const total = DATA.units.reduce((n, u) => n + u.lessons.length, 0);
    const doneIds = Object.keys(state.done);
    $("#stat-done").textContent = `${doneIds.length}/${total}`;
    const avg = doneIds.length ? Math.round(doneIds.reduce((s, id) => s + (state.done[id].best || 0), 0) / doneIds.length) : null;
    $("#stat-avg").textContent = avg == null ? "–" : avg + "%";
    $("#opt-typing").checked = !!state.settings.typing;

    const pending = Object.keys(state.review).filter((id) => state.review[id] > 0);
    $("#review-card").classList.toggle("hidden", pending.length < 4);
    $("#review-count").textContent = pending.length;

    const root = $("#units");
    root.innerHTML = "";
    let nextFound = false;
    for (const u of DATA.units) {
      const doneCount = u.lessons.filter((l) => state.done[l.id]).length;
      const el = document.createElement("section");
      el.className = "unit";
      el.innerHTML = `
        <div class="unit-head">
          <div><h2>${esc(u.title)}</h2><p>${esc(u.hint)}</p></div>
          <div class="unit-meta">
            ${u.weight ? `<span class="chip">${u.weight}% da prova</span>` : ""}
            <span class="unit-progress">${doneCount}/${u.lessons.length} lições</span>
          </div>
        </div>
        <div class="lessons"></div>`;
      const grid = el.querySelector(".lessons");
      u.lessons.forEach((l, i) => {
        const b = document.createElement("button");
        b.type = "button";
        const rec = state.done[l.id];
        const done = !!rec;
        const weak = done && rec.best < OK;
        const next = !done && !nextFound;
        if (next) nextFound = true;
        b.className = "lesson-btn" + (done ? " done" : "") + (weak ? " weak" : "") + (next ? " next" : "");
        b.innerHTML = `<span class="num">${done ? rec.best + "%" : i + 1}</span>
          <span><span class="lbl">${esc(l.title)}</span><br><span class="cnt">${l.terms.length} termos${done ? ` · ${rec.times}× feita` : ""}</span></span>`;
        b.addEventListener("click", () => startLesson(u, l));
        grid.appendChild(b);
      });
      root.appendChild(el);
    }
  }

  // ---------- lição ----------
  let L = null;

  function startLesson(unit, lesson, practice) {
    L = {
      unit, lesson, practice: !!practice,
      queue: buildExercises(lesson, { unitId: unit ? unit.id : null, typing: state.settings.typing }),
      idx: 0, correct: 0, answered: 0,
      wrong: new Map(), // termId -> Set(kinds)
      started: Date.now(), current: null, done: false, selection: null,
    };
    show("lesson");
    nextExercise();
  }

  function startReview() {
    const ids = shuffle(Object.keys(state.review).filter((id) => state.review[id] > 0)).slice(0, 10);
    startLesson(null, { id: "review", title: "Revisão dos termos errados", terms: ids }, true);
  }

  function renderScore() {
    $("#score").innerHTML = `<b>${L.correct}</b>/${L.answered} certas`;
  }
  function renderProgress() {
    const pct = Math.round((L.idx / L.queue.length) * 100);
    $("#progress-fill").style.width = pct + "%";
    $("#progress").setAttribute("aria-valuenow", pct);
  }

  function nextExercise() {
    if (L.idx >= L.queue.length) return finishLesson();
    L.current = L.queue[L.idx];
    L.done = false; L.selection = null;
    renderScore(); renderProgress();
    $("#lesson-footer").className = "lesson-footer";
    $("#feedback").classList.add("hidden");
    const check = $("#btn-check");
    check.textContent = "Verificar"; check.disabled = true;
    $("#btn-skip").classList.toggle("hidden", L.current.kind === "match");
    renderExercise(L.current);
  }

  const PROMPTS = {
    mc_en_pt: ["O que significa?", "Múltipla escolha"],
    mc_pt_en: ["Qual é o termo em inglês?", "Múltipla escolha"],
    context: ["Complete a frase da prova", "Múltipla escolha"],
    type: ["Escreva em inglês", "Digitação"],
    match: ["Ligue os pares", "Pares"],
    trap: ["Jogada certa ou armadilha?", "Princípios"],
  };

  function renderExercise(ex) {
    const root = $("#exercise");
    const [label, tag] = PROMPTS[ex.kind];
    let html = `<p class="prompt-label">${label}<span class="type-tag">${tag}</span></p>`;

    if (ex.kind === "mc_en_pt") {
      html += `<h2 class="prompt">${ex.term.en}</h2>`;
      if (ex.term.sub && L.unit) html += `<p class="subtle">${esc(L.unit.title)} · ${esc(ex.term.sub.replace(/\s*\([^)]*\)/g, ""))}</p>`;
      html += optionsHtml(ex.options.map((t) => esc(t.pt)));
    } else if (ex.kind === "mc_pt_en") {
      html += `<h2 class="prompt small">${esc(ex.term.pt)}</h2>`;
      html += optionsHtml(ex.options.map((t) => t.en));
    } else if (ex.kind === "context") {
      html += `<div class="prompt-card">${esc(ex.term.exBlank).replace("____", '<span class="blank"></span>')}</div>`;
      html += optionsHtml(ex.options.map((t) => t.en));
    } else if (ex.kind === "type") {
      html += `<h2 class="prompt small">${esc(ex.term.pt)}</h2>`;
      html += `<input class="type-input" id="type-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Digite o termo em inglês">`;
    } else if (ex.kind === "trap") {
      html += `<div class="prompt-card"><span class="principle-n">Princípio ${ex.principle.n} · ${esc(ex.principle.en)}</span>${esc(ex.statement)}</div>`;
      html += `<div class="options">
        <button type="button" class="opt big" data-i="0" data-v="correct"><span class="key">1</span>Jogada certa</button>
        <button type="button" class="opt big" data-i="1" data-v="trap"><span class="key">2</span>Armadilha</button></div>`;
    } else if (ex.kind === "match") {
      const left = shuffle(ex.pairs), right = shuffle(ex.pairs);
      html += `<div class="match-grid">
        <div class="match-col">${left.map((t) => `<button type="button" class="match-btn" data-side="en" data-id="${t.id}">${t.en}</button>`).join("")}</div>
        <div class="match-col">${right.map((t) => `<button type="button" class="match-btn" data-side="pt" data-id="${t.id}">${esc(t.pt)}</button>`).join("")}</div>
      </div>`;
    }
    root.innerHTML = html;

    if (ex.kind === "match") {
      ex.matched = new Set(); ex.errors = 0; ex.errorIds = new Set(); let sel = null;
      root.querySelectorAll(".match-btn").forEach((b) => b.addEventListener("click", () => {
        if (b.classList.contains("matched")) return;
        if (sel === b) { b.classList.remove("selected"); sel = null; return; }
        if (sel && sel.dataset.side === b.dataset.side) { sel.classList.remove("selected"); sel = b; b.classList.add("selected"); return; }
        if (!sel) { sel = b; b.classList.add("selected"); return; }
        const a = sel; sel = null; a.classList.remove("selected");
        if (a.dataset.id === b.dataset.id) {
          a.classList.add("matched"); b.classList.add("matched"); ex.matched.add(b.dataset.id);
          if (ex.matched.size === ex.pairs.length) {
            const ok = ex.errors === 0;
            recordAnswer(ok, null);
            if (!ok) ex.errorIds.forEach((id) => noteWrong(TERMS[id], "match"));
            showFeedback(ok, ok ? `<span class="answer">Todos os pares ligados sem erro.</span>`
              : `<span class="answer">Pares ligados, com ${ex.errors} tentativa${ex.errors > 1 ? "s" : ""} errada${ex.errors > 1 ? "s" : ""}.</span>`);
          }
        } else {
          ex.errors++; ex.errorIds.add(a.dataset.id); ex.errorIds.add(b.dataset.id);
          [a, b].forEach((x) => { x.classList.add("shake"); setTimeout(() => x.classList.remove("shake"), 350); });
        }
      }));
      return;
    }

    if (ex.kind === "type") {
      const inp = $("#type-input");
      inp.addEventListener("input", () => { $("#btn-check").disabled = !inp.value.trim(); });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && inp.value.trim()) { e.preventDefault(); advance(); } });
      setTimeout(() => inp.focus(), 50);
      return;
    }

    root.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => selectOption(b)));
  }

  function optionsHtml(labels) {
    return `<div class="options">${labels.map((l, i) => `<button type="button" class="opt" data-i="${i}"><span class="key">${i + 1}</span><span>${l}</span></button>`).join("")}</div>`;
  }
  function selectOption(btn) {
    if (L.done) return;
    document.querySelectorAll(".opt").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    L.selection = btn;
    $("#btn-check").disabled = false;
  }

  const explanation = (term) => `<div class="expl">${term.ptFull}</div>`;
  const answerLine = (ex) => ex.kind === "mc_en_pt" ? esc(ex.term.pt) : ex.term.en;

  function noteWrong(term, kind) {
    if (!term) return;
    if (!L.wrong.has(term.id)) L.wrong.set(term.id, new Set());
    L.wrong.get(term.id).add(kind);
    state.review[term.id] = (state.review[term.id] || 0) + 1;
  }
  function recordAnswer(ok, term) {
    L.done = true; L.answered++;
    if (ok) {
      L.correct++;
      if (term && L.practice) state.review[term.id] = Math.max(0, (state.review[term.id] || 0) - 1);
    } else if (!L.current.retry) {
      L.queue.push(Object.assign({}, L.current, { retry: true })); // volta no fim da lição
    }
    save();
  }

  function check() {
    if (L.done) return;
    const ex = L.current;
    let ok = false, body = "";

    if (ex.kind === "type") {
      const val = norm($("#type-input").value);
      const variants = ex.term.variants.map(norm);
      const exact = variants.includes(val);
      const near = !exact && variants.some((v) => v.length >= 6 && levenshtein(v, val) <= 1);
      ok = exact || near;
      body = `<span class="answer">${near ? "Quase — grafia correta: " : "Resposta: "}${ex.term.en}</span>${explanation(ex.term)}`;
      $("#type-input").disabled = true;
    } else if (ex.kind === "trap") {
      ok = L.selection.dataset.v === ex.answer;
      body = `<span class="answer">${ex.answer === "trap" ? "Isto é a armadilha." : "Esta é a jogada certa."} Princípio ${ex.principle.n}: ${esc(ex.principle.en)}</span>${ex.term ? explanation(ex.term) : ""}`;
      markOptions((b) => b.dataset.v === ex.answer);
    } else {
      const chosen = ex.options[Number(L.selection.dataset.i)];
      ok = chosen.id === ex.term.id;
      body = `<span class="answer">Resposta: ${answerLine(ex)}</span>${explanation(ex.term)}`;
      if (ex.term.ex && ex.kind !== "context") body += `<div class="ex">Ex.: ${esc(ex.term.ex)}</div>`;
      markOptions((b) => ex.options[Number(b.dataset.i)].id === ex.term.id);
    }

    recordAnswer(ok, ex.term);
    if (!ok) noteWrong(ex.term, ex.kind);
    save();
    showFeedback(ok, body);
  }

  function skip() {
    if (L.done) return;
    const ex = L.current;
    let body;
    if (ex.kind === "type") { $("#type-input").disabled = true; body = `<span class="answer">Resposta: ${ex.term.en}</span>${explanation(ex.term)}`; }
    else if (ex.kind === "trap") { body = `<span class="answer">${ex.answer === "trap" ? "Era a armadilha." : "Era a jogada certa."} Princípio ${ex.principle.n}: ${esc(ex.principle.en)}</span>${ex.term ? explanation(ex.term) : ""}`; markOptions((b) => b.dataset.v === ex.answer); }
    else { body = `<span class="answer">Resposta: ${answerLine(ex)}</span>${explanation(ex.term)}`; markOptions((b) => ex.options[Number(b.dataset.i)].id === ex.term.id); }
    recordAnswer(false, ex.term);
    noteWrong(ex.term, ex.kind);
    save();
    showFeedback(false, body);
  }

  function markOptions(isCorrect) {
    document.querySelectorAll(".opt").forEach((b) => {
      b.disabled = true;
      if (isCorrect(b)) b.classList.add("correct");
      else if (b.classList.contains("selected")) b.classList.add("wrong");
    });
  }

  function showFeedback(ok, body) {
    $("#lesson-footer").className = "lesson-footer " + (ok ? "ok" : "bad");
    $("#feedback").classList.remove("hidden");
    $("#feedback-title").textContent = ok ? "Correto" : "Incorreto";
    $("#feedback-body").innerHTML = body;
    $("#btn-skip").classList.add("hidden");
    renderScore();
    const c = $("#btn-check");
    c.disabled = false; c.textContent = L.idx + 1 >= L.queue.length ? "Ver resultado" : "Continuar";
    c.focus();
  }

  function advance() {
    if (!L.done) return check();
    L.idx++;
    nextExercise();
  }

  // ---------- resultado e orientação de estudo ----------
  function finishLesson() {
    const acc = L.answered ? Math.round((L.correct / L.answered) * 100) : 0;
    const secs = Math.round((Date.now() - L.started) / 1000);
    if (!L.practice) {
      const prev = state.done[L.lesson.id] || { times: 0, best: 0 };
      state.done[L.lesson.id] = { times: prev.times + 1, best: Math.max(prev.best || 0, acc), last: acc };
    }
    save();

    $("#result-kicker").textContent = L.practice ? "Revisão concluída" : `${L.unit.title} · lição concluída`;
    $("#result-title").textContent = L.lesson.title;
    $("#result-acc").textContent = acc + "%";
    $("#result-count").textContent = `${L.correct}/${L.answered}`;
    $("#result-time").textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    $("#result-guidance").innerHTML = guidanceHtml(acc);
    const pending = Object.keys(state.review).filter((id) => state.review[id] > 0).length;
    $("#btn-review-now").classList.toggle("hidden", pending < 4 || L.practice);
    show("result");
  }

  function guidanceHtml(acc) {
    const wrongIds = [...L.wrong.keys()];
    const parts = [];

    // veredito
    let cls, text;
    if (acc >= GOOD) { cls = "good"; text = wrongIds.length ? "Você domina este bloco. Vale só reler os termos abaixo e seguir em frente." : "Você domina este bloco. Pode seguir para a próxima lição."; }
    else if (acc >= OK) { cls = "mid"; text = "Bom resultado, mas há termos que ainda não estão firmes. Revise a lista abaixo antes de avançar."; }
    else { cls = "low"; text = "Este bloco ainda precisa de estudo. Releia os termos abaixo com as explicações e refaça a lição até passar de 70%."; }
    parts.push(`<h2>O que estudar para melhorar</h2><div class="verdict ${cls}">${text}</div>`);

    if (wrongIds.length) {
      // agrupa por unidade > subseção
      const groups = new Map();
      for (const id of wrongIds) {
        const t = TERMS[id]; const u = unitOf(t.unit);
        const key = `${u.title} · ${t.sub}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
      }
      let html = `<h3>Termos para revisar (${wrongIds.length})</h3>`;
      for (const [key, terms] of groups) {
        html += `<p class="group-title">${esc(key)}</p><ul>` + terms.map((t) =>
          `<li><b>${t.en}</b> — ${esc(t.pt)}</li>`).join("") + `</ul>`;
      }
      parts.push(html);

      // lições relacionadas (na revisão, os termos vêm de várias lições)
      const lessons = new Map();
      for (const id of wrongIds) { const r = lessonOfTerm(id); if (r && (L.practice || r.lesson.id !== L.lesson.id)) lessons.set(r.lesson.id, r); }
      if (acc < GOOD && !L.practice) lessons.set(L.lesson.id, { unit: L.unit, lesson: L.lesson });
      if (lessons.size) {
        parts.push(`<h3>Lições para refazer</h3><ul>` + [...lessons.values()].map((r) =>
          `<li>${esc(r.lesson.title)}<span class="where">${esc(r.unit.title)}${r.unit.weight ? ` · ${r.unit.weight}% da prova` : ""}</span></li>`).join("") + `</ul>`);
      }

      // padrão dos erros
      const kinds = {};
      for (const set of L.wrong.values()) for (const k of set) kinds[k] = (kinds[k] || 0) + 1;
      const tips = [];
      if ((kinds.mc_pt_en || 0) + (kinds.type || 0) >= 2) tips.push("Você reconhece o significado, mas tem dificuldade em lembrar a forma em inglês. Ative os exercícios de digitação nas configurações e repita a lição.");
      if ((kinds.mc_en_pt || 0) >= 2) tips.push("Os erros se concentram em reconhecer o termo em inglês: ao refazer a lição, leia com atenção a explicação e os exemplos (<i>Ex.:</i>) de cada resposta — eles mostram o termo no contexto da prova.");
      if (kinds.trap) tips.push("Releia os 12 princípios: a prova cobra justamente a diferença entre a jogada certa e a armadilha em cada um.");
      if (kinds.context) tips.push("Treine a leitura das frases da prova em inglês: o contexto da questão ajuda a fixar o uso do termo.");
      if (kinds.match) tips.push("Nos pares, o erro costuma vir de termos parecidos (ex.: <i>precision</i> vs. <i>recall</i>, <i>upstream</i> vs. <i>downstream</i>). Compare as definições desses termos lado a lado.");
      if (tips.length) parts.push(`<h3>Dicas</h3>` + tips.map((t) => `<p class="tip">${t}</p>`).join(""));
    }

    // próxima lição
    if (!L.practice) {
      const next = nextLesson();
      if (next && acc >= OK) parts.push(`<h3>Próximo passo</h3><p>Siga para <b>${esc(next.lesson.title)}</b> (${esc(next.unit.title)}).</p>`);
    }
    return parts.join("");
  }

  function nextLesson() {
    const inUnit = L.unit.lessons.find((l) => !state.done[l.id]);
    if (inUnit) return { unit: L.unit, lesson: inUnit };
    for (const u of DATA.units) for (const l of u.lessons) if (!state.done[l.id]) return { unit: u, lesson: l };
    return null;
  }

  // ---------- eventos ----------
  $("#btn-check").addEventListener("click", advance);
  $("#btn-skip").addEventListener("click", skip);
  $("#btn-quit").addEventListener("click", () => {
    if (L.answered === 0 || confirm("Sair da lição? A pontuação desta tentativa será descartada.")) { renderHome(); show("home"); }
  });
  $("#btn-continue").addEventListener("click", () => { renderHome(); show("home"); });
  $("#btn-redo").addEventListener("click", () => { if (L.practice) startReview(); else startLesson(L.unit, L.lesson); });
  $("#btn-review").addEventListener("click", startReview);
  $("#btn-review-now").addEventListener("click", startReview);
  $("#opt-typing").addEventListener("change", (e) => { state.settings.typing = e.target.checked; save(); });
  $("#btn-reset").addEventListener("click", () => {
    if (confirm("Apagar todo o progresso (pontuações e termos a revisar)?")) { state = defaultState(); save(); renderHome(); }
  });

  document.addEventListener("keydown", (e) => {
    if (screens.lesson.classList.contains("hidden") || !L) return;
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.key === "Enter") { e.preventDefault(); if (L.done || L.selection) advance(); return; }
    if (/^[1-4]$/.test(e.key) && !L.done) {
      const b = document.querySelector(`.opt[data-i="${Number(e.key) - 1}"]`);
      if (b) selectOption(b);
    }
  });

  renderHome();
  show("home");
})();
