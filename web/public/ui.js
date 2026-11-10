// 動き・部品（ui-motion-parts）。__ICON_名前__ は pick.py が Lucide のSVGに置き換える
// 部品ごとに「// @part 名前」で区切ってある。pick.py で使う部品だけ書き出す
//
// ふつうのサイト：読み込むだけで、ページにある部品が動く
// アプリ（あとから画面を書き換える）：
//   ui.init(要素)     … あとから出した部品を動かす（同じ部品を2回動かすことはない）
//   ui.destroy(要素)  … 消す前に、その中の部品のタイマーなどを片付ける
//   ui.watch()        … 画面の変化を見張って、上の2つを自動でやる（<script src="ui.js" data-watch> でも同じ）
(function () {
  var R = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var ui = window.ui = window.ui || {};
  var me = document.currentScript;
  // 画面に出る文言。英語などのサイトは、ui.js より前に window.UI_TEXT = { close: 'Close', … } を書けば差し替わる
  var T = Object.assign({
    close: '閉じる', menuOpen: 'メニューを開く', menuClose: 'メニューを閉じる',
    slide: '{n}枚目へ', zoom: '写真を拡大表示', prev: '前の写真', next: '次の写真',
    mqStop: '流れを止める', copied: 'コピーしました', copyNg: 'コピーできませんでした',
    acList: '候補', acHits: '{n}件の候補があります', acNone: '候補はありません'
  }, window.UI_TEXT || {});
  var tx = function (k, n) { return T[k].replace('{n}', n); };
  // 1つの部品でエラーが出ても、ほかの部品は動かす
  var part = function (fn) { try { fn(); } catch (e) { console.error(e); } };

  // ---- 部品を動かす仕組み ----
  var inits = [], offs = [];
  // 部品ごとに「範囲（root）の中を探して動かす」関数を登録する
  var add = function (fn) { inits.push(fn); };
  // 同じ要素を2回動かさないための目印
  var once = function (el, k) { var s = el.__ui || (el.__ui = {}); if (s[k]) return false; s[k] = 1; return true; };
  // root の中と、root 自身から探す
  var finds = function (sel, root) { var a = $$(sel, root); if (root.matches && root.matches(sel)) a.unshift(root); return a; };
  // 要素が消えるときの後片付けを登録する
  var keep = function (el, off) { offs.push({ el: el, off: off }); };
  ui.init = function (root) { root = root || document; inits.forEach(function (f) { part(function () { f(root); }); }); };
  ui.destroy = function (root) {
    offs = offs.filter(function (o) {
      var hit = root ? root === o.el || (root.contains && root.contains(o.el)) : !o.el.isConnected;
      if (hit) part(o.off);
      return !hit;
    });
  };
  var mo = null;
  ui.watch = function () {
    if (mo || !window.MutationObserver) return;
    var added = [], sweep = false, tick = null;
    mo = new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) added.push(n); });
        if (m.removedNodes.length) sweep = true;
      });
      if (tick) return;
      // まとめて1回だけ処理する。動かしただけの要素は消えた扱いにしない
      tick = setTimeout(function () {
        tick = null;
        var a = added; added = [];
        a.forEach(function (n) { if (n.isConnected) ui.init(n); });
        if (sweep) { sweep = false; ui.destroy(); }
      }, 0);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  };

  // @part kt
  // ---- キネティック・タイポグラフィ：見出しを1文字ずつ動かす（文字が変わらない見出しに使う） ----
  var PUNC = '、。，．」』）】!?！？';
  var go = function (el) { el.classList.add('kt-go'); };
  var kio = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { go(e.target); kio.unobserve(e.target); } }); }, { threshold: .3 }) : null;
  add(function (root) {
    finds('.kt', root).forEach(function (el) {
      if (R || !once(el, 'kt')) return;
      var i = 0;
      (function walk(n) {
        [].slice.call(n.childNodes).forEach(function (c) {
          if (c.nodeType === 3) {
            var f = document.createDocumentFragment(), last = null;
            Array.from(c.textContent).forEach(function (ch) {
              if (/\s/.test(ch)) { f.appendChild(document.createTextNode(ch)); last = null; return; }
              if (last && PUNC.indexOf(ch) >= 0) { last.textContent += ch; return; }
              var s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i++); s.textContent = ch; f.appendChild(s); last = s;
            });
            c.replaceWith(f);
          } else if (c.nodeType === 1 && c.tagName !== 'BR' && c.tagName.toLowerCase() !== 'svg') walk(c);
        });
      })(el);
      el.classList.add('kt-on');
      // 最初から画面に見えている見出しは、すぐ動かす
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) go(el); else if (kio) kio.observe(el);
      setTimeout(function () { go(el); }, 5000);
    });
  });

  // @part uiux
  // ---- UI/UXアニメーション：ボタンの波紋（.btn・.car-btn・data-ripple）、ヘッダー（.hd）の影 ----
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.btn, .car-btn, [data-ripple]');
    if (!b || R) return;
    var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span');
    s.className = 'rp'; s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s); setTimeout(function () { s.remove(); }, 650);
  });
  var onScroll = function () { var hd = document.querySelector('.hd'); if (hd) hd.classList.toggle('scrolled', scrollY > 8); };
  addEventListener('scroll', onScroll, { passive: true });
  add(onScroll);

  // @part toast
  // ---- トースト：ui.toast('保存しました') で短い知らせを出し、4秒で消す ----
  var tbox = null;
  // 読み上げソフトに届くように、知らせの入れ物は先に置いておく
  add(function () {
    if (tbox && tbox.isConnected) return;
    tbox = document.createElement('div'); tbox.className = 'toasts';
    tbox.setAttribute('role', 'status'); tbox.setAttribute('aria-live', 'polite');
    document.body.appendChild(tbox);
  });
  ui.toast = function (msg, o) {
    o = o || {};
    if (!tbox || !tbox.isConnected) ui.init(document.body);
    var t = document.createElement('div'), s = document.createElement('span'), timer;
    t.className = 'toast' + (o.type === 'err' ? ' err' : '');
    t.innerHTML = o.type === 'err' ? '<svg class="ic" xmlns="http://www.w3.org/2000/svg" width="24" height="24" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>' : '<svg class="ic" xmlns="http://www.w3.org/2000/svg" width="24" height="24" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ><circle cx="12" cy="12" r="10"/><path d="m16 9-5.5 5.5L8 12"/></svg>';
    s.textContent = msg; t.appendChild(s); tbox.appendChild(t);
    while (tbox.children.length > 3) tbox.firstChild.remove();
    var gone = function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 260); };
    var start = function () { clearTimeout(timer); timer = setTimeout(gone, o.ms || 4000); };
    t.addEventListener('pointerenter', function () { clearTimeout(timer); });
    t.addEventListener('pointerleave', start);
    start();
    return t;
  };
  // data-toast="送りました" を付けたボタンは押すと知らせを出す。data-copy="文字" はコピーして知らせる
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-toast], [data-copy]'); if (!b) return;
    if (!b.hasAttribute('data-copy')) { ui.toast(b.getAttribute('data-toast')); return; }
    var txt = b.getAttribute('data-copy') || b.textContent.trim();
    var ng = function () { ui.toast(T.copyNg, { type: 'err' }); };
    if (!navigator.clipboard) { ng(); return; }
    navigator.clipboard.writeText(txt).then(function () { ui.toast(b.getAttribute('data-toast') || T.copied); }, ng);
  });

  // @part skel
  // ---- スケルトンスクリーン：読み込み中は灰色の形だけ見せる ----
  // 写真（img に data-sk）：読み込みが終わるまで光る灰色の箱
  add(function (root) {
    finds('img[data-sk]', root).forEach(function (img) {
      if (!once(img, 'sk') || (img.complete && img.naturalWidth)) return;
      img.classList.add('sk-wait');
      img.addEventListener('load', function () { img.classList.remove('sk-wait'); img.classList.add('sk-ld'); });
      img.addEventListener('error', function () { img.classList.remove('sk-wait'); });
    });
  });
  // 一覧などをあとから入れるとき：ui.unskel(入れ物, HTML)。入れた中の部品も動かす
  ui.unskel = function (el, html) {
    el.innerHTML = html; el.removeAttribute('aria-busy');
    el.classList.remove('sk-in'); void el.offsetWidth; el.classList.add('sk-in');
    ui.init(el);
  };

  // @end
  var start = function () {
    ui.init(document);
    if (me && me.hasAttribute('data-watch')) ui.watch();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
