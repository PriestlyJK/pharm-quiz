// ══════════════════════════════════════════════
// PHARMA TRAINER — APP LOGIC
// ══════════════════════════════════════════════

const STATE = {
  sel: null,      // selected drug id
  tab: 'home',    // 'home'|'learn'|'quiz'
  filter: '',     // group filter
  search: '',     // search string
  quiz: [],       // shuffled questions for current drug
  qi: 0,          // question index
  qscore: 0,      // correct answers in this session
  answered: false,
  matchSel: null, // selected match item {col,idx}
  matchDone: [],  // completed match pairs
  streak: 0,
  learned: new Set(),
  weak: new Set(),
};

// ── GROUPS ──────────────────────────────────
const GROUPS = [...new Set(DRUGS.map(d => d.g))];
const GCOLORS = {};
const GC_LIST = ['var(--acc)','var(--gr)','var(--cy)','var(--am)','var(--rd)',
  '#f472b6','#a78bfa','#34d399','#fb923c','#60a5fa','#e879f9','#4ade80'];
GROUPS.forEach((g,i) => GCOLORS[g] = GC_LIST[i % GC_LIST.length]);

// ── INIT ─────────────────────────────────────
function init() {
  loadProgress();
  buildFilters();
  buildList();
  showHome();
  document.getElementById('srch').addEventListener('input', e => {
    STATE.search = e.target.value.toLowerCase();
    buildList();
  });
}

function loadProgress() {
  try {
    const l = JSON.parse(localStorage.getItem('pharma_learned') || '[]');
    const w = JSON.parse(localStorage.getItem('pharma_weak') || '[]');
    STATE.learned = new Set(l);
    STATE.weak = new Set(w);
  } catch(e) {}
}

function saveProgress() {
  localStorage.setItem('pharma_learned', JSON.stringify([...STATE.learned]));
  localStorage.setItem('pharma_weak', JSON.stringify([...STATE.weak]));
}

// ── FILTERS ──────────────────────────────────
function buildFilters() {
  const el = document.getElementById('filters');
  el.innerHTML = `<div class="fb all on" onclick="setFilter('')">Всі</div>` +
    GROUPS.map(g => `<div class="fb" onclick="setFilter('${g}')">${g.split(' ')[0]}</div>`).join('');
}

function setFilter(g) {
  STATE.filter = g;
  document.querySelectorAll('.fb').forEach(b => {
    b.classList.remove('on');
    if (g === '' && b.classList.contains('all')) b.classList.add('on');
    if (g && b.textContent === g.split(' ')[0]) b.classList.add('on');
  });
  buildList();
}

// ── DRUG LIST ─────────────────────────────────
function visible() {
  return DRUGS.filter(d => {
    const gOk = !STATE.filter || d.g === STATE.filter;
    const sOk = !STATE.search || d.n.toLowerCase().includes(STATE.search)
      || d.grp.toLowerCase().includes(STATE.search)
      || d.g.toLowerCase().includes(STATE.search);
    return gOk && sOk;
  });
}

function buildList() {
  const el = document.getElementById('dlist');
  const vis = visible();
  if (!vis.length) { el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx3);font-size:12px">Нічого не знайдено</div>'; return; }
  el.innerHTML = vis.map(d => {
    const cls = STATE.learned.has(d.id) ? 'ok' : STATE.weak.has(d.id) ? 'wk' : '';
    const sel = STATE.sel === d.id ? 'sel' : '';
    return `<div class="di ${cls} ${sel}" onclick="openDrug(${d.id})">
      <div class="di-dot"></div>
      <div class="di-txt">
        <div class="di-name">${d.n}</div>
        <div class="di-sub">${d.grp.split('(')[0].trim().substring(0,28)}</div>
      </div>
    </div>`;
  }).join('');
  updateStats();
}

function updateStats() {
  const l = STATE.learned.size, w = STATE.weak.size;
  document.getElementById('stot').textContent = DRUGS.length;
  document.getElementById('slrn').textContent = l;
  document.getElementById('swk').textContent = w;
  document.getElementById('pf').style.width = Math.round(l / DRUGS.length * 100) + '%';
}

// ── NAVIGATION ────────────────────────────────
function setNav(id) {
  document.querySelectorAll('.nb').forEach(n => n.classList.remove('on'));
  const el = document.getElementById('nb-' + id);
  if (el) el.classList.add('on');
}

function mc() { return document.getElementById('mc'); }

// ── HOME ─────────────────────────────────────
function showHome() {
  STATE.tab = 'home';
  setNav('home');
  const gc = GROUPS.map(g => {
    const count = DRUGS.filter(d => d.g === g).length;
    const done = DRUGS.filter(d => d.g === g && STATE.learned.has(d.id)).length;
    const pct = Math.round(done / count * 100);
    const col = GCOLORS[g];
    return `<div class="gcard" onclick="setFilter('${g}');buildList();openDrug(${DRUGS.find(d=>d.g===g).id})">
      <div class="gcard-n" style="color:${col}">${count}</div>
      <div class="gcard-name">${g}</div>
      <div class="gcard-sub">${done}/${count} вивчено · ${pct}%</div>
      <div class="gcard-bar"><div class="gcard-fill" style="width:${pct}%;background:${col}"></div></div>
    </div>`;
  }).join('');
  mc().innerHTML = `<div class="home fi">
    <div class="home-h">Фармакологія Модуль 2</div>
    <div class="home-sub">206 препаратів · ультра-детальні розбори · 15–20 тестів на кожен препарат</div>
    <div class="qrow">
      <div class="act-btn btn-pr btn" onclick="pickRandom()">🎲 Випадковий препарат</div>
      <div class="act-btn btn" onclick="startQuiz(false)">⚡ Тест по поточному</div>
      <div class="act-btn btn" onclick="startWeakQuiz()">🔥 Слабкі місця</div>
      <div class="act-btn btn" onclick="startAllQuiz()">📚 Зміша з усіх</div>
    </div>
    <div class="gc">${gc}</div>
  </div>`;
}

// ── OPEN DRUG ─────────────────────────────────
function openDrug(id) {
  STATE.sel = id;
  buildList();
  showLearn();
}

function showLearn() {
  if (!STATE.sel) { pickRandom(); return; }
  STATE.tab = 'learn';
  setNav('learn');
  const d = DRUGS.find(x => x.id === STATE.sel);
  if (!d) return;
  renderLearn(d);
}

function renderLearn(d) {
  const chains = (d.chain || []).map((c, i, arr) => {
    const last = i === arr.length - 1;
    return `<div class="cs">
      <div class="cs-line">
        <div class="cs-num">${i+1}</div>
        ${!last ? '<div class="cs-conn"></div>' : ''}
      </div>
      <div class="cs-text">${c}</div>
    </div>`;
  }).join('');

  const indTags = (d.ind || '').split('.').filter(Boolean).map(x =>
    `<span class="tag tag-ind">${x.trim()}</span>`).join('');
  const sideTags = (d.side || '').split('.').filter(Boolean).map(x =>
    `<span class="tag tag-side">${x.trim()}</span>`).join('');
  const contraTags = (d.contra || '').split('.').filter(Boolean).map(x =>
    `<span class="tag tag-contra">${x.trim()}</span>`).join('');
  const comboTags = (d.combo || '').split('.').filter(Boolean).map(x =>
    `<span class="tag tag-combo">${x.trim()}</span>`).join('');

  mc().innerHTML = `<div class="content fi">
    <div class="dh">
      <div class="dh-name">${d.n}</div>
      <div class="dh-badges">
        <span class="badge b-grp">${d.grp}</span>
        <span class="badge b-g">${d.g}</span>
        ${STATE.learned.has(d.id) ? '<span class="badge" style="background:var(--grb);color:var(--gr);border:1px solid rgba(62,207,142,.3)">✓ Вивчено</span>' : ''}
        ${STATE.weak.has(d.id) ? '<span class="badge" style="background:var(--amb);color:var(--am);border:1px solid rgba(251,191,36,.3)">⚠ Слабке місце</span>' : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-label">Механізм дії</div>
      <div class="card-val">${d.mech}</div>
    </div>

    <div class="grid2">
      <div class="card">
        <div class="card-label">Показання</div>
        <div class="tags">${indTags}</div>
      </div>
      <div class="card">
        <div class="card-label">Побічні ефекти</div>
        <div class="tags">${sideTags}</div>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <div class="card-label">Протипоказання</div>
        <div class="tags">${contraTags}</div>
      </div>
      <div class="card">
        <div class="card-label">Комбінації та взаємодія</div>
        <div class="tags">${comboTags}</div>
      </div>
    </div>

    <div class="card">
      <div class="chain-label card-label">Ланцюг дії (логіка)</div>
      <div class="chain-steps">${chains}</div>
    </div>

    ${d.tip ? `<div class="tip"><div class="tip-lbl">💡 Клінічний ключ</div>${d.tip}</div>` : ''}

    <div class="brow">
      <button class="btn btn-pr" onclick="startQuiz(false)">▶ Тест по препарату (${(d.q||[]).length} питань)</button>
      <button class="btn btn-gr" onclick="markLearned()">✓ Вивчено</button>
      <button class="btn btn-am" onclick="markWeak()">⚠ Слабко знаю</button>
      <button class="btn btn-gh" onclick="nextDrug(-1)">← Попередній</button>
      <button class="btn btn-gh" onclick="nextDrug(1)">Наступний →</button>
    </div>
  </div>`;
}

function nextDrug(dir) {
  const vis = visible();
  const idx = vis.findIndex(d => d.id === STATE.sel);
  const next = vis[idx + dir];
  if (next) openDrug(next.id);
}

function pickRandom() {
  const vis = visible();
  if (!vis.length) return;
  const notLearned = vis.filter(d => !STATE.learned.has(d.id));
  const pool = notLearned.length ? notLearned : vis;
  openDrug(pool[Math.floor(Math.random() * pool.length)].id);
}

// ── MARK ──────────────────────────────────────
function markLearned() {
  if (!STATE.sel) return;
  STATE.learned.add(STATE.sel);
  STATE.weak.delete(STATE.sel);
  saveProgress();
  buildList();
  showLearn();
}

function markWeak() {
  if (!STATE.sel) return;
  STATE.weak.add(STATE.sel);
  STATE.learned.delete(STATE.sel);
  saveProgress();
  buildList();
  showLearn();
}

// ── QUIZ ──────────────────────────────────────
function startQuiz(global) {
  let qs;
  if (global) {
    qs = DRUGS.flatMap(d => (d.q || []).map(q => ({ ...q, _drug: d.id, _dname: d.n })));
  } else {
    if (!STATE.sel) { pickRandom(); return; }
    const d = DRUGS.find(x => x.id === STATE.sel);
    qs = (d.q || []).map(q => ({ ...q, _drug: d.id, _dname: d.n }));
  }
  // shuffle
  for (let i = qs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [qs[i], qs[j]] = [qs[j], qs[i]];
  }
  STATE.quiz = qs;
  STATE.qi = 0;
  STATE.qscore = 0;
  STATE.answered = false;
  STATE.matchSel = null;
  STATE.matchDone = [];
  STATE.tab = 'quiz';
  setNav('quiz');
  renderQ();
}

function startWeakQuiz() {
  const weakDrugs = DRUGS.filter(d => STATE.weak.has(d.id));
  if (!weakDrugs.length) {
    alert('Слабких місць ще немає — пройди кілька тестів!');
    return;
  }
  const qs = weakDrugs.flatMap(d => (d.q || []).map(q => ({ ...q, _drug: d.id, _dname: d.n })));
  for (let i = qs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [qs[i], qs[j]] = [qs[j], qs[i]];
  }
  STATE.quiz = qs.slice(0, 40);
  STATE.qi = 0;
  STATE.qscore = 0;
  STATE.answered = false;
  STATE.matchSel = null;
  STATE.matchDone = [];
  STATE.tab = 'quiz';
  setNav('weak');
  renderQ();
}

function startAllQuiz() {
  startQuiz(true);
}

function renderQ() {
  if (STATE.qi >= STATE.quiz.length) { showComplete(); return; }
  const q = STATE.quiz[STATE.qi];
  const dname = q._dname || (DRUGS.find(d => d.id === q._drug) || {}).n || '';

  const top = `<div class="quiz-top">
    <div>
      <div class="qprog">Питання <strong>${STATE.qi + 1}</strong> / ${STATE.quiz.length}</div>
      ${dname ? `<div style="font-size:10px;color:var(--tx3);margin-top:2px;font-family:var(--mono)">${dname}</div>` : ''}
    </div>
    <div class="qscore">✓ ${STATE.qscore} правильних</div>
  </div>`;

  if (q.type === 'mcq') renderMCQ(q, top);
  else if (q.type === 'case') renderCase(q, top);
  else if (q.type === 'match') renderMatch(q, top);
  else renderMCQ(q, top);
}

function renderMCQ(q, top) {
  const opts = q.o.map((o, i) => `
    <button class="opt" onclick="checkMCQ(${i}, ${q.a})">
      <div class="opt-k">${'АБВГД'[i]}</div>
      <div class="opt-t">${o}</div>
    </button>`).join('');
  mc().innerHTML = `<div class="content fi quiz-wrap">
    ${top}
    <div class="qtype qt-mcq">MCQ</div>
    <div class="qtext">${q.q}</div>
    <div class="opts">${opts}</div>
  </div>`;
}

function renderCase(q, top) {
  const opts = q.o.map((o, i) => `
    <button class="opt" onclick="checkMCQ(${i}, ${q.a})">
      <div class="opt-k">${'АБВГД'[i]}</div>
      <div class="opt-t">${o}</div>
    </button>`).join('');
  mc().innerHTML = `<div class="content fi quiz-wrap">
    ${top}
    <div class="qtype qt-case">Клінічний кейс</div>
    <div class="case-box">${q.scenario}</div>
    <div class="qtext">${q.q}</div>
    <div class="opts">${opts}</div>
  </div>`;
}

function checkMCQ(chosen, correct) {
  if (STATE.answered) return;
  STATE.answered = true;
  if (chosen === correct) {
    STATE.qscore++;
    STATE.streak++;
    const d = STATE.quiz[STATE.qi];
    if (STATE.streak >= 3 && d && STATE.weak.has(d._drug)) {
      STATE.weak.delete(d._drug);
      saveProgress();
    }
  } else {
    STATE.streak = 0;
    const d = STATE.quiz[STATE.qi];
    if (d) { STATE.weak.add(d._drug); saveProgress(); }
  }

  const q = STATE.quiz[STATE.qi];
  document.querySelectorAll('.opt').forEach((el, i) => {
    el.classList.add('dis');
    if (i === correct) el.classList.add('reveal');
    else if (i === chosen && chosen !== correct) el.classList.add('wrong');
  });

  const nav = `<div class="expl"><strong>Пояснення:</strong> ${q.ex}</div>
    <div class="qnav">
      <button class="btn btn-pr" onclick="nextQ()">Наступне питання →</button>
      <button class="btn btn-gh" onclick="openDrug(${q._drug || STATE.sel})">Переглянути препарат</button>
    </div>`;
  document.querySelector('.content').insertAdjacentHTML('beforeend', nav);
  buildList();
}

function nextQ() {
  STATE.qi++;
  STATE.answered = false;
  STATE.matchSel = null;
  STATE.matchDone = [];
  renderQ();
}

// ── MATCH ─────────────────────────────────────
function renderMatch(q, top) {
  STATE.matchDone = [];
  STATE.matchSel = null;

  const pairs = q.pairs;
  const lefts = pairs.map(p => p[0]);
  const rights = shuffle([...pairs.map(p => p[1])]);

  mc().innerHTML = `<div class="content fi quiz-wrap">
    ${top}
    <div class="qtype qt-match">Зіставлення</div>
    <div class="qtext">${q.q}</div>
    <div class="match-area">
      <div>
        <div class="match-col-h">Препарат / Поняття</div>
        <div class="match-items" id="lefts">
          ${lefts.map((l, i) => `<div class="mi" id="L${i}" onclick="matchClick('L',${i},'${escape(l)}')">${l}</div>`).join('')}
        </div>
      </div>
      <div>
        <div class="match-col-h">Відповідність</div>
        <div class="match-items" id="rights">
          ${rights.map((r, i) => `<div class="mi" id="R${i}" onclick="matchClick('R',${i},'${escape(r)}')">${r}</div>`).join('')}
        </div>
      </div>
    </div>
    <div id="match-expl"></div>
  </div>`;
  // store mapping
  mc().dataset.lefts = JSON.stringify(lefts);
  mc().dataset.rights = JSON.stringify(rights);
  mc().dataset.pairs = JSON.stringify(pairs);
}

function escape(s) { return s.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function shuffle(arr) { for (let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr; }

function matchClick(col, idx, val) {
  const el = document.getElementById(col + idx);
  if (!el || el.classList.contains('ok') || el.classList.contains('dis')) return;

  if (!STATE.matchSel) {
    // first click
    document.querySelectorAll('.mi.sel').forEach(e => e.classList.remove('sel'));
    STATE.matchSel = { col, idx, val };
    el.classList.add('sel');
  } else {
    // second click — try match
    const prev = STATE.matchSel;
    STATE.matchSel = null;
    document.querySelectorAll('.mi.sel').forEach(e => e.classList.remove('sel'));

    if (prev.col === col) {
      // same column — reselect
      STATE.matchSel = { col, idx, val };
      el.classList.add('sel');
      return;
    }

    // determine left/right
    const pairs = JSON.parse(mc().dataset.pairs || '[]');
    const lefts = JSON.parse(mc().dataset.lefts || '[]');
    const rights = JSON.parse(mc().dataset.rights || '[]');

    let leftVal, rightVal, leftIdx, rightIdx;
    if (prev.col === 'L') {
      leftVal = prev.val; rightVal = val;
      leftIdx = prev.idx; rightIdx = idx;
    } else {
      leftVal = val; rightVal = prev.val;
      leftIdx = idx; rightIdx = prev.idx;
    }

    const correct = pairs.find(p => p[0] === unescape(leftVal) && p[1] === unescape(rightVal));
    const lEl = document.getElementById('L' + leftIdx);
    const rEl = document.getElementById('R' + rightIdx);

    if (correct) {
      [lEl, rEl].forEach(e => { e.classList.add('ok'); e.classList.add('dis'); });
      STATE.matchDone.push(leftVal);
      if (STATE.matchDone.length === pairs.length) matchComplete(pairs);
    } else {
      [lEl, rEl].forEach(e => { e.classList.add('bad'); setTimeout(() => e.classList.remove('bad'), 600); });
    }
  }
}

function matchComplete(pairs) {
  const q = STATE.quiz[STATE.qi];
  STATE.qscore++;
  STATE.answered = true;
  const expl = document.getElementById('match-expl');
  if (expl) expl.innerHTML = `<div class="expl"><strong>✓ Всі пари знайдено!</strong> ${q.ex}</div>
    <div class="qnav"><button class="btn btn-pr" onclick="nextQ()">Наступне питання →</button></div>`;
}

// ── COMPLETE ──────────────────────────────────
function showComplete() {
  const total = STATE.quiz.length;
  const pct = total ? Math.round(STATE.qscore / total * 100) : 0;
  let icon = '🎉', msg = 'Чудово!';
  if (pct < 50) { icon = '😅'; msg = 'Треба повторити!'; }
  else if (pct < 70) { icon = '💪'; msg = 'Непогано, але ще є над чим попрацювати'; }
  else if (pct < 90) { icon = '🔥'; msg = 'Добре! Залишилось трохи'; }
  else { icon = '⭐'; msg = 'Відмінно! Препарат засвоєний!'; }

  if (STATE.sel && pct >= 70) {
    STATE.learned.add(STATE.sel);
    STATE.weak.delete(STATE.sel);
    saveProgress();
    buildList();
  }

  mc().innerHTML = `<div class="content fi">
    <div class="complete">
      <div class="comp-icon">${icon}</div>
      <div class="score-big">${pct}%</div>
      <div class="score-lbl">${STATE.qscore} з ${total} правильних</div>
      <div class="comp-title">${msg}</div>
      <div class="comp-sub">${pct >= 70 ? 'Препарат відмічено як вивчений ✓' : 'Відмічено як слабке місце — повтори розбір'}</div>
      <div class="brow" style="justify-content:center">
        <button class="btn btn-pr" onclick="startQuiz(false)">Пройти ще раз</button>
        <button class="btn btn-gh" onclick="showLearn()">Переглянути розбір</button>
        <button class="btn btn-gh" onclick="pickRandom()">Наступний препарат →</button>
        <button class="btn btn-am" onclick="startWeakQuiz()">Слабкі місця 🔥</button>
      </div>
    </div>
  </div>`;
}

// ── BOOT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
