/* グラスヒット＆ブロー — Glass Hit & Blow
 * 入力: D-pad（矢印キー）とタップ（Enter）のみ。Escape は PC 確認用の補助。
 * 依存ライブラリなし。すべて DOM。
 * ?auto=1 で自動プレイ（デモ録画用。記録は保存しない）。?seed=N で答えを固定。
 */
(function () {
  'use strict';

  // ---------- 状態 ----------
  var AUTO = /[?&]auto=1/.test(location.search);
  var seedM = /[?&]seed=(\d+)/.exec(location.search);
  var seed = seedM ? +seedM[1] : 0;
  var rand = seedM
    ? function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    : Math.random;

  var N = 4;                 // けた数（3 or 4）
  var secret = [], guesses = [], input = [], cands = [];
  var pos = 1;               // 0=≡メニュー, 1..N=けた, N+1=決定
  var over = false;
  var mode = 'title', menuIdx = 0, menuItems = [], menuEl = 'title-list';
  var stats = { best3: 0, best4: 0, clears: 0 };

  var el = function (id) { return document.getElementById(id); };

  // ---------- 保存 ----------
  var KEY = 'glass-hitblow-v1';
  function save() {
    if (AUTO) return;
    try { localStorage.setItem(KEY, JSON.stringify({ n: N, s: stats })); }
    catch (e) { /* 保存できなくても動作には影響しない */ }
  }
  function load() {
    if (AUTO) return;
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s) return;
      N = s.n === 3 ? 3 : 4;
      if (s.s) stats = { best3: s.s.best3 | 0, best4: s.s.best4 | 0, clears: s.s.clears | 0 };
    } catch (e) { /* 壊れていたら初期値のまま */ }
  }

  // ---------- ルール ----------
  function perms(n) {
    var out = [];
    (function rec(cur) {
      if (cur.length === n) { out.push(cur.slice()); return; }
      for (var d = 0; d < 10; d++) {
        if (cur.indexOf(d) < 0) { cur.push(d); rec(cur); cur.pop(); }
      }
    })([]);
    return out;
  }
  function judge(a, b) {
    var h = 0, bl = 0;
    for (var i = 0; i < a.length; i++) {
      if (a[i] === b[i]) h++;
      else if (b.indexOf(a[i]) >= 0) bl++;
    }
    return { h: h, b: bl };
  }

  function newGame() {
    var pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    secret = [];
    for (var i = 0; i < N; i++) secret.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    guesses = [];
    input = [];
    for (i = 0; i < N; i++) input.push(null);
    cands = perms(N);
    pos = 1;
    over = false;
    mode = 'game';
    show('game');
    renderGame(false);
  }

  // ---------- 入力（けた） ----------
  function usedElsewhere(i) {
    var u = [];
    for (var j = 0; j < N; j++) if (j !== i && input[j] !== null) u.push(input[j]);
    return u;
  }
  function stepDigit(i, dir, from) {
    var used = usedElsewhere(i);
    var d = from === null ? (dir > 0 ? -1 : 10) : from;
    for (var k = 0; k < 11; k++) {
      d = (d + dir + 10) % 10;
      if (used.indexOf(d) < 0) return d;
    }
    return from;
  }
  function roll(dir) {
    var i = pos - 1;
    input[i] = stepDigit(i, dir, input[i]);
    renderGame(false);
    var s = el('input').children[pos];
    s.classList.remove('roll'); void s.offsetWidth; s.classList.add('roll');
  }
  function complete() {
    for (var i = 0; i < N; i++) if (input[i] === null) return false;
    return true;
  }
  function submit() {
    if (!complete()) {
      toast('数字をぜんぶ入れてね');
      for (var i = 0; i < N; i++) if (input[i] === null) { pos = i + 1; break; }
      renderGame(false);
      return;
    }
    var g = input.slice();
    for (i = 0; i < guesses.length; i++) {
      if (guesses[i].g.join('') === g.join('')) { toast('その数字はもう試したよ'); return; }
    }
    var r = judge(g, secret);
    guesses.push({ g: g, h: r.h, b: r.b });
    cands = cands.filter(function (c) { var q = judge(g, c); return q.h === r.h && q.b === r.b; });
    if (r.h === N) {
      over = true;
      var k = 'best' + N;
      var isBest = !stats[k] || guesses.length < stats[k];
      if (!AUTO) { stats.clears++; if (isBest) stats[k] = guesses.length; save(); }
      renderGame(true);
      toast('🎉 ' + N + 'ヒット！');
      setTimeout(function () { winMenu(isBest && !AUTO); }, 1100);
      return;
    }
    pos = 1;
    renderGame(true);
    toast(r.h + 'ヒット ' + r.b + 'ブロー');
  }

  // ---------- 描画（ゲーム） ----------
  function pips(h, b) {
    var s = '';
    for (var i = 0; i < N; i++) {
      s += i < h ? '<span class="h">●</span>' : i < h + b ? '<span class="b">○</span>' : '<span class="z">・</span>';
    }
    return s;
  }
  function renderGame(fresh) {
    el('hud-right').textContent = N + 'けた ・ ' + (over ? guesses.length : guesses.length + 1) + '回目';

    var hist = el('history');
    if (!guesses.length) {
      hist.innerHTML = '<div class="empty">かくされた' + N + 'けたの数字（重複なし）を推理しよう<br>' +
        '<span style="color:#7bffb0">● ヒット</span>＝数字も位置も一致　' +
        '<span style="color:#ffd166">○ ブロー</span>＝数字だけ一致</div>';
    } else {
      var start = Math.max(0, guesses.length - 6), html = '';
      for (var i = start; i < guesses.length; i++) {
        var q = guesses[i], last = i === guesses.length - 1;
        html += '<div class="row' + (last && fresh ? ' new' : '') + (q.h === N ? ' win' : '') + '">' +
          '<span class="no">#' + (i + 1) + '</span>' +
          '<span class="g">' + q.g.join('') + '</span>' +
          '<span class="pips">' + pips(q.h, q.b) + '</span>' +
          '<span class="res"><span class="h">' + q.h + 'H</span> <span class="b">' + q.b + 'B</span></span></div>';
      }
      hist.innerHTML = html;
    }

    el('cands').innerHTML = over ? '正解！' : 'のこり候補 <b>' + cands.length + '</b> 通り';
    var dg = '';
    for (var d = 0; d < 10; d++) {
      var cnt = 0;
      for (var c = 0; c < cands.length; c++) if (cands[c].indexOf(d) >= 0) cnt++;
      dg += '<span class="dg' + (cnt === cands.length ? ' in' : cnt === 0 ? ' out' : '') + '">' + d + '</span>';
    }
    el('digits').innerHTML = dg;

    var inp = '<div class="slot btn' + (pos === 0 ? ' cur' : '') + '" data-p="0">≡</div>';
    for (i = 0; i < N; i++) {
      inp += '<div class="slot' + (input[i] === null ? ' q' : '') + (pos === i + 1 ? ' cur' : '') +
        '" data-p="' + (i + 1) + '">' + (input[i] === null ? '?' : input[i]) + '</div>';
    }
    inp += '<div class="slot ok' + (complete() ? ' ready' : '') + (pos === N + 1 ? ' cur' : '') +
      '" data-p="' + (N + 1) + '">決定</div>';
    el('input').innerHTML = inp;

    el('hint').textContent = pos === 0 ? 'タップでメニュー ・ → 数字の入力へ'
      : pos === N + 1 ? 'タップで決定 ・ ← もどって修正'
      : '↑↓ 数字 ・ ←→ けた ・ タップで次へ';
  }

  var toastT = 0;
  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 1400);
  }

  // ---------- 画面とメニュー ----------
  function show(id) {
    ['title', 'game', 'menu', 'howto'].forEach(function (s) { el(s).classList.toggle('hidden', s !== id); });
  }
  function setMenu(listId, items, idx) {
    menuEl = listId; menuItems = items; menuIdx = idx || 0;
    paintMenu();
  }
  function paintMenu() {
    var list = el(menuEl);
    list.innerHTML = '';
    menuItems.forEach(function (it, i) {
      var b = document.createElement('div');
      b.className = 'rail-btn' + (i === menuIdx ? ' cur' : '');
      var label = typeof it.label === 'function' ? it.label() : it.label;
      b.innerHTML = '<span>' + label + '</span>' + (it.sub ? '<small>' + it.sub + '</small>' : '');
      b.addEventListener('click', function () { menuIdx = i; paintMenu(); it.act(); });
      list.appendChild(b);
    });
  }

  function goTitle() {
    mode = 'title';
    show('title');
    el('hud-right').textContent = '';
    el('title-sub').innerHTML = 'かくされた数字を、ヒントから推理する<br>' +
      'ベスト 3けた ' + (stats.best3 ? stats.best3 + '回' : '—') +
      ' ・ 4けた ' + (stats.best4 ? stats.best4 + '回' : '—') + ' ・ クリア ' + stats.clears + '回';
    setMenu('title-list', [
      { label: '▶ はじめる', act: newGame },
      { label: function () { return 'けた数　◀ ' + N + 'けた ▶'; }, sub: N === 3 ? 'かんたん' : 'ふつう',
        act: toggleN, lr: toggleN },
      { label: 'つかいかた', act: goHowto }
    ], menuEl === 'title-list' ? menuIdx : 0);
  }
  function toggleN() {
    N = N === 3 ? 4 : 3;
    save();
    goTitle();
  }
  function goHowto() {
    mode = 'howto';
    show('howto');
    setMenu('howto-list', [{ label: '← タイトルにもどる', act: goTitle }]);
  }
  function pauseMenu() {
    mode = 'menu';
    show('menu');
    el('menu-title').textContent = 'メニュー';
    el('menu-sub').textContent = guesses.length + '回 試した ・ のこり候補 ' + cands.length + ' 通り';
    setMenu('menu-list', [
      { label: '← ゲームにもどる', act: backToGame },
      { label: 'あきらめて答えを見る', act: giveUp },
      { label: 'タイトルへ', act: goTitle }
    ]);
  }
  function backToGame() { mode = 'game'; show('game'); renderGame(false); }
  function giveUp() {
    over = true;
    mode = 'menu';
    el('menu-title').textContent = '答え';
    el('menu-sub').innerHTML = '<span class="ans">' + secret.join('') + '</span><br>' + guesses.length + '回 試した';
    setMenu('menu-list', [
      { label: '▶ もう一度', act: newGame },
      { label: 'タイトルへ', act: goTitle }
    ]);
  }
  function winMenu(isBest) {
    mode = 'menu';
    show('menu');
    el('menu-title').textContent = '🎉 正解！';
    el('menu-sub').innerHTML = '<span class="ans">' + secret.join('') + '</span><br>' +
      N + 'けたを ' + guesses.length + '回で当てた' + (isBest ? ' ・ ベスト更新！' : '');
    setMenu('menu-list', [
      { label: '▶ もう一度', act: newGame },
      { label: 'タイトルへ', act: goTitle }
    ]);
  }

  // ---------- キー ----------
  function menuKey(key) {
    var it = menuItems[menuIdx];
    if (key === 'ArrowUp') { menuIdx = (menuIdx + menuItems.length - 1) % menuItems.length; paintMenu(); }
    else if (key === 'ArrowDown') { menuIdx = (menuIdx + 1) % menuItems.length; paintMenu(); }
    else if ((key === 'ArrowLeft' || key === 'ArrowRight') && it && it.lr) it.lr();
    else if (key === 'Enter' || key === ' ') { if (it) it.act(); }
    else return false;
    return true;
  }
  function gameKey(key) {
    if (over) return true;
    if (key === 'ArrowLeft') { pos = (pos + N + 1) % (N + 2); renderGame(false); }
    else if (key === 'ArrowRight') { pos = (pos + 1) % (N + 2); renderGame(false); }
    else if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (pos >= 1 && pos <= N) roll(key === 'ArrowUp' ? 1 : -1);
    } else if (key === 'Enter' || key === ' ') {
      if (pos === 0) pauseMenu();
      else if (pos === N + 1) submit();
      else {
        if (input[pos - 1] === null) input[pos - 1] = stepDigit(pos - 1, 1, null);
        pos++;
        renderGame(false);
      }
    } else return false;
    return true;
  }
  function handleKey(key) {
    if (key === 'Escape') { // PC確認用の補助（グラスでは戻るジェスチャーが使えない）
      if (mode === 'howto') goTitle();
      else if (mode === 'game') pauseMenu();
      else if (mode === 'menu' && !over) backToGame();
      else if (mode === 'menu') goTitle();
      return true;
    }
    return mode === 'game' ? gameKey(key) : menuKey(key);
  }

  document.addEventListener('keydown', function (e) {
    if (AUTO && e.isTrusted) { e.preventDefault(); return; }
    if (e.repeat && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') { e.preventDefault(); return; }
    if (handleKey(e.key)) e.preventDefault();
  });
  el('input').addEventListener('click', function (e) {
    var s = e.target.closest('.slot');
    if (!s || mode !== 'game' || over) return;
    var p = +s.getAttribute('data-p');
    if (p === pos || p === 0 || p === N + 1) { pos = p; gameKey('Enter'); }
    else { pos = p; renderGame(false); }
  });

  // ---------- 自動プレイ（デモ録画用） ----------
  function solverGuess() {
    if (!guesses.length) return N === 4 ? [0, 1, 2, 3] : [0, 1, 2];
    if (cands.length <= 2) return cands[0];
    var best = null, bestW = Infinity;
    cands.forEach(function (g) {
      var parts = {}, w = 0;
      cands.forEach(function (c) {
        var r = judge(g, c), k = r.h * 10 + r.b;
        parts[k] = (parts[k] || 0) + 1;
        if (parts[k] > w) w = parts[k];
      });
      if (w < bestW) { bestW = w; best = g; }
    });
    return best;
  }
  function stepsTo(i, dir, target) {
    var d = input[i];
    for (var k = 1; k <= 11; k++) {
      d = stepDigit(i, dir, d);
      if (d === target) return k;
    }
    return Infinity;
  }
  var plan = null;
  function autoKey() {
    if (mode === 'title') return 'Enter';
    if (mode !== 'game' || over) return null;
    if (!plan) plan = solverGuess();
    var i, t = -1;
    for (i = 0; i < N; i++) {
      if (input[i] !== plan[i] && usedElsewhere(i).indexOf(plan[i]) < 0) { t = i; break; }
    }
    if (t < 0) for (i = 0; i < N; i++) if (input[i] !== plan[i]) { t = i; break; }
    if (t < 0) {
      if (pos !== N + 1) return 'ArrowRight';
      plan = null;
      return 'Enter';
    }
    if (pos !== t + 1) return pos < t + 1 ? 'ArrowRight' : 'ArrowLeft';
    var up = stepsTo(t, 1, plan[t]), dn = stepsTo(t, -1, plan[t]);
    return up <= dn ? 'ArrowUp' : 'ArrowDown';
  }
  function autoTick() {
    var k = autoKey();
    if (!k) return;
    var wasSubmit = mode === 'game' && k === 'Enter' && pos === N + 1;
    handleKey(k);
    setTimeout(autoTick, mode === 'game' && wasSubmit ? 1300 : k === 'Enter' && !wasSubmit ? 600 : 140);
  }

  load();
  goTitle();
  if (AUTO) setTimeout(autoTick, 1100);
})();
