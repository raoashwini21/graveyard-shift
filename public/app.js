// Graveyard Shift UI. Plain browser JavaScript, no build step.
(() => {
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const WEIGHT = { dead: 10, possessed: 6, chain: 4, nameless: 6, speechless: 3, 'stale-year': 5, 'past-event': 7, locked: 0 };
  const PLURAL = {
    dead: 'Dead links', possessed: 'Possessed links', chain: 'Redirect chains', nameless: 'Nameless pages',
    speechless: 'Speechless pages', 'stale-year': 'Stale years', 'past-event': 'Past events',
  };
  const ghostScore = (g) => Math.round((WEIGHT[g.type] || 0) * Math.min(1 + (g.foundOn.length - 1) * 0.25, 3));
  const rankOf = (s) => (s === 0 ? 'At peace' : s <= 20 ? 'Restless' : s <= 50 ? 'Haunted' : s <= 100 ? 'Infested' : 'Cursed');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  let state = { result: null, banished: new Set(), filter: 'all', initialScore: 0 };
  const shortUrl = (u) => {
    if (!u) return '';
    if (u === 'sitemap.xml') return 'sitemap.xml';
    try {
      const x = new URL(u);
      if (state.result && hostOf(u) !== hostOf(state.result.site)) return u;
      return x.pathname === '/' && !x.search ? 'home page' : x.pathname + x.search;
    } catch { return u; }
  };

  // ---------- Sound (off by default, made in the browser, no files) ----------
  let audio = null;
  let soundOn = store.get('gs:sound', false);
  const tone = (freq, dur, type = 'sine', gain = 0.15, slideTo = null) => {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, audio.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, audio.currentTime + dur);
      g.gain.setValueAtTime(gain, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + dur);
    } catch {}
  };
  const sounds = {
    thud: () => { tone(70, 1.2, 'sine', 0.35, 40); tone(140, 0.6, 'triangle', 0.08, 90); },
    banish: () => { tone(520, 0.5, 'sine', 0.08, 1040); setTimeout(() => tone(780, 0.6, 'sine', 0.05, 1560), 90); },
    peace: () => [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 1.4, 'sine', 0.06), i * 160)),
  };
  const soundBtn = $('sound');
  const paintSound = () => { soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off'; };
  soundBtn.onclick = () => { soundOn = !soundOn; store.set('gs:sound', soundOn); paintSound(); if (soundOn) tone(440, 0.2, 'sine', 0.05); };
  paintSound();

  // ---------- Boring mode ----------
  const boringBtn = $('boring');
  const setBoring = (on) => {
    document.body.classList.toggle('boring', on);
    boringBtn.setAttribute('aria-pressed', String(on));
    store.set('gs:boring', on);
  };
  boringBtn.onclick = () => setBoring(!document.body.classList.contains('boring'));
  setBoring(store.get('gs:boring', false));

  // ---------- The walk ----------
  let source = null;
  let raf = null;
  const walk = $('walk');
  const halls = $('halls');
  // The lantern drifts toward the page that was just walked, with a slow wobble.
  const target = { x: 50, y: 45 };
  const pos = { x: 50, y: 45 };
  const startLantern = () => {
    const t0 = performance.now();
    const step = (t) => {
      const s = (t - t0) / 1000;
      if (reduceMotion) { pos.x = target.x; pos.y = target.y; }
      else {
        pos.x += (target.x + 3 * Math.sin(s * 1.3) - pos.x) * 0.045;
        pos.y += (target.y + 2 * Math.cos(s * 1.1) - pos.y) * 0.045;
      }
      walk.style.setProperty('--lx', pos.x + '%');
      walk.style.setProperty('--ly', pos.y + '%');
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const stopLantern = () => { if (raf) cancelAnimationFrame(raf); raf = null; };
  const addHall = (url) => {
    const span = document.createElement('span');
    span.textContent = shortUrlFor(url);
    const left = 6 + Math.random() * 74;
    const top = 8 + Math.random() * 66;
    span.style.left = left + '%';
    span.style.top = top + '%';
    target.x = left + 6;
    target.y = top + 1;
    span.style.fontSize = (0.8 + Math.random() * 0.7) + 'rem';
    halls.appendChild(span);
    while (halls.children.length > 70) halls.firstChild.remove();
  };
  let scanHost = '';
  const shortUrlFor = (u) => { try { const x = new URL(u); return hostOf(u) === scanHost ? (x.pathname === '/' ? 'home' : x.pathname) : x.hostname; } catch { return u; } };

  const showGate = () => {
    $('gate').style.display = '';
    $('yard').classList.remove('on');
    document.body.classList.remove('dawn');
  };

  const stopWalk = () => {
    if (source) source.close();
    source = null;
    stopLantern();
    walk.classList.remove('on');
  };

  $('cancel').onclick = () => { stopWalk(); showGate(); $('url').focus(); };

  $('visit').onsubmit = (e) => {
    e.preventDefault();
    const url = $('url').value.trim();
    if (!url) return;
    $('error').textContent = '';
    try { scanHost = hostOf(/^https?:/i.test(url) ? url : 'https://' + url); } catch { scanHost = url; }
    halls.innerHTML = '';
    walk.classList.add('on');
    startLantern();
    const walkText = $('walkText');
    walkText.textContent = 'Lighting the lantern…';
    const qs = new URLSearchParams({ url, maxPages: $('maxPages').value, external: $('external').checked ? '1' : '0' });
    source = new EventSource('/api/scan?' + qs);
    let pages = 0;
    source.addEventListener('progress', (m) => {
      const d = JSON.parse(m.data);
      if (d.type === 'phase' && d.phase === 'knocking') walkText.textContent = 'Knocking on the front door…';
      if (d.type === 'phase' && d.phase === 'reading the map') walkText.textContent = 'Reading the map of the grounds…';
      if (d.type === 'page') {
        pages = d.pagesScanned;
        addHall(d.url);
        walkText.innerHTML = `Walking the halls: <strong>${pages}</strong> page${pages === 1 ? '' : 's'}`;
      }
      if (d.type === 'link') {
        if (d.linksChecked % 3 === 0) addHall(d.url);
        walkText.innerHTML = `Knocking on every door: <strong>${d.linksChecked}</strong> of ${d.linksTotal} links`;
      }
    });
    source.addEventListener('done', (m) => {
      const result = JSON.parse(m.data);
      stopWalk();
      reveal(result);
    });
    source.addEventListener('fail', (m) => {
      stopWalk();
      showGate();
      $('error').textContent = JSON.parse(m.data).message;
    });
    source.onerror = () => {
      if (!source) return;
      stopWalk();
      showGate();
      $('error').textContent = 'Lost the connection to the scanner. Check it is still running in your terminal, then try again.';
    };
  };

  // ---------- The reveal ----------
  const reveal = (result) => {
    state.result = result;
    state.banished = new Set(store.get('gs:banished:' + result.site, []));
    state.filter = 'all';
    state.initialScore = result.ghosts.reduce((n, g) => n + ghostScore(g), 0);
    const n = result.ghostCount;

    if (document.body.classList.contains('boring')) { showYard(); return; }

    const box = $('reveal');
    const count = $('revealCount');
    count.classList.remove('lit');
    count.textContent = n ? `${n} ghost${n === 1 ? '' : 's'} found` : 'No ghosts found';
    $('revealSub').textContent = n ? `${hostOf(result.site)} is ${rankOf(result.score).toLowerCase()}.` : `${hostOf(result.site)} is at peace.`;
    box.classList.add('on');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      box.classList.remove('on');
      box.removeEventListener('click', finish);
      document.removeEventListener('keydown', finish);
      showYard();
    };
    setTimeout(() => {
      count.classList.add('lit');
      sounds.thud();
    }, reduceMotion ? 0 : 900);
    setTimeout(finish, reduceMotion ? 1600 : 3800);
    box.addEventListener('click', finish);
    document.addEventListener('keydown', finish);
  };

  // ---------- The graveyard ----------
  const visible = () => state.result.ghosts.filter((g) => g.type !== 'locked' && !state.banished.has(g.id));
  const currentScore = () => visible().reduce((n, g) => n + ghostScore(g), 0);

  const paintBoss = () => {
    const now = currentScore();
    const max = state.initialScore || 1;
    $('bossName').textContent = `Haunting score: ${rankOf(now)}`;
    $('bossNum').textContent = `${now} of ${state.initialScore}`;
    $('bossFill').style.width = Math.max(0, (now / max) * 100) + '%';
    $('bossTrack').setAttribute('aria-valuenow', String(now));
    $('bossTrack').setAttribute('aria-valuemax', String(state.initialScore));
  };

  const paintTitle = () => {
    const r = state.result;
    const left = visible().length;
    const host = hostOf(r.site);
    $('yardTitle').textContent = left
      ? `${left} ghost${left === 1 ? '' : 's'} haunt${left === 1 ? 's' : ''} ${host}`
      : `${host} is at peace`;
    const gone = state.banished.size;
    $('yardMeta').textContent = `Walked ${r.pagesScanned} page${r.pagesScanned === 1 ? '' : 's'} and checked ${r.linksChecked.toLocaleString()} links.` +
      (gone ? ` You've banished ${gone}.` : '');
  };

  const paintFilters = () => {
    const counts = {};
    for (const g of visible()) counts[g.type] = (counts[g.type] || 0) + 1;
    const types = Object.keys(PLURAL).filter((t) => counts[t]);
    if (state.filter !== 'all' && !counts[state.filter]) state.filter = 'all';
    const btn = (key, text) => `<button data-f="${key}" aria-pressed="${state.filter === key}">${esc(text)}</button>`;
    $('filters').innerHTML = types.length > 1
      ? btn('all', `All ${visible().length}`) + types.map((t) => btn(t, `${PLURAL[t]} ${counts[t]}`)).join('')
      : '';
    $('filters').querySelectorAll('button').forEach((b) => {
      b.onclick = () => { state.filter = b.dataset.f; paintStones(); paintFilters(); };
    });
  };

  const stoneHtml = (g) => {
    const subject = g.quote
      ? `<p class="subject quote">“${esc(g.quote)}”</p>`
      : `<p class="subject">${esc(shortUrl(g.url))}</p>`;
    const where = g.foundOn.length === 1
      ? `<p class="subject" style="background:none;padding:0">Found on ${esc(shortUrl(g.foundOn[0]))}</p>`
      : `<details><summary>Found on ${g.foundOn.length} pages</summary><ul>${g.foundOn.map((p) => `<li>${esc(shortUrl(p))}</li>`).join('')}</ul></details>`;
    const openUrl = g.url && g.url.startsWith('http') && !['stale-year', 'past-event'].includes(g.type) ? g.url : (g.foundOn[0] !== 'sitemap.xml' ? g.foundOn[0] : g.url);
    return `<article class="stone" data-type="${esc(g.type)}" data-id="${esc(g.id)}">
      <div class="kind">${esc(g.name)}${g.confidence === 'maybe' ? ' <span class="maybe">(maybe)</span>' : ''}</div>
      <p class="epitaph">${esc(g.label)}</p>
      ${subject}
      ${where}
      <p class="fix"><b>Fix:</b> ${esc(g.fix)}</p>
      <div class="row">
        <button class="banish" data-banish="${esc(g.id)}">Banish</button>
        ${openUrl ? `<a href="${esc(openUrl)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}
      </div>
    </article>`;
  };

  const paintStones = () => {
    const list = visible().filter((g) => state.filter === 'all' || g.type === state.filter);
    $('stones').innerHTML = list.map(stoneHtml).join('');
    $('stones').querySelectorAll('[data-banish]').forEach((b) => { b.onclick = () => banish(b.dataset.banish, b.closest('.stone')); });
    paintPlain();
  };

  const paintPlain = () => {
    const rows = visible().map((g) => `<tr><td>${esc(g.name)}${g.confidence === 'maybe' ? ' (maybe)' : ''}</td>
      <td>${esc(g.quote ? '“' + g.quote + '”' : shortUrl(g.url))}</td>
      <td>${esc(shortUrl(g.foundOn[0]))}${g.foundOn.length > 1 ? ` and ${g.foundOn.length - 1} more` : ''}</td>
      <td>${esc(g.fix)}</td></tr>`).join('');
    $('plain').innerHTML = rows
      ? `<table><thead><tr><th>Problem</th><th>Link or text</th><th>Found on</th><th>Fix</th></tr></thead><tbody>${rows}</tbody></table>`
      : '';
  };

  const paintLocked = () => {
    const locked = state.result.ghosts.filter((g) => g.type === 'locked');
    const el = $('locked');
    if (!locked.length) { el.style.display = 'none'; return; }
    el.style.display = '';
    const byHost = {};
    for (const g of locked) (byHost[hostOf(g.url)] = byHost[hostOf(g.url)] || []).push(g);
    const hosts = Object.entries(byHost).sort((a, b) => b[1].length - a[1].length);
    el.innerHTML = `<summary>${locked.length} locked door${locked.length === 1 ? '' : 's'}: links on sites that block bots, so they couldn't be checked</summary>
      <p>Mostly ${hosts.slice(0, 4).map(([h, l]) => `${esc(h)} (${l.length})`).join(', ')}. Open the ones that matter yourself.</p>
      <ul>${locked.map((g) => `<li><a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">${esc(g.url)}</a></li>`).join('')}</ul>`;
  };

  const paintLimits = () => {
    const l = state.result.limits || {};
    const notes = [];
    if (l.pagesCapped) notes.push(`Stopped after ${l.maxPages} pages. Your site has more; run the terminal version with --max-pages to walk them all.`);
    if (l.linksCapped) notes.push(`Checked ${state.result.linksChecked.toLocaleString()} of ${l.linksTotal.toLocaleString()} links. Your own links were checked first.`);
    if (l.robotsSkipped) notes.push(`Skipped ${l.robotsSkipped} page${l.robotsSkipped === 1 ? '' : 's'} that your robots.txt asks bots to stay out of.`);
    $('limits').innerHTML = notes.map((n) => `<p>${esc(n)}</p>`).join('');
  };

  const paintPeace = () => {
    const atPeace = visible().length === 0;
    $('peace').classList.toggle('on', atPeace);
    $('boss').style.display = atPeace ? 'none' : '';
    $('filters').style.display = atPeace ? 'none' : '';
    document.body.classList.toggle('dawn', atPeace && !document.body.classList.contains('boring'));
    $('peaceText').textContent = state.result.ghostCount === 0
      ? `We walked ${state.result.pagesScanned} pages and found nothing dead. Come back in a few weeks; links rot quietly.`
      : 'Every ghost has been banished. Scan again after you fix things to make sure they stay gone.';
  };

  const showYard = () => {
    $('gate').style.display = 'none';
    $('yard').classList.add('on');
    paintTitle(); paintBoss(); paintFilters(); paintStones(); paintLocked(); paintLimits(); paintPeace();
    $('yardTitle').setAttribute('tabindex', '-1');
    $('yardTitle').focus({ preventScroll: false });
    window.scrollTo(0, 0);
  };

  const banish = (id, el) => {
    state.banished.add(id);
    store.set('gs:banished:' + state.result.site, [...state.banished]);
    sounds.banish();
    const after = () => {
      paintTitle(); paintBoss(); paintFilters(); paintStones(); paintPeace();
      if (!visible().length) sounds.peace();
    };
    if (el && !reduceMotion) { el.classList.add('banished'); setTimeout(after, 950); } else after();
  };

  $('again').onclick = () => { showGate(); $('url').select(); $('url').focus(); };

  // ---------- Exports ----------
  const download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  const exportAs = async (format) => {
    const res = await fetch('/api/export?format=' + format, { method: 'POST', body: JSON.stringify(state.result) });
    if (!res.ok) return;
    download(await res.blob(), `ghosts-${hostOf(state.result.site)}.${format === 'csv' ? 'csv' : 'md'}`);
  };
  $('exportMd').onclick = () => exportAs('md');
  $('exportCsv').onclick = () => exportAs('csv');

  // ---------- Share card ----------
  $('share').onclick = async () => {
    const r = state.result;
    try { await document.fonts.load('64px "IM Fell English"'); } catch {}
    const W = 1200, H = 630;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    // night and fog
    x.fillStyle = '#142023'; x.fillRect(0, 0, W, H);
    const fog = x.createRadialGradient(W / 2, H + 80, 50, W / 2, H + 80, 700);
    fog.addColorStop(0, 'rgba(142,165,164,.35)'); fog.addColorStop(1, 'rgba(142,165,164,0)');
    x.fillStyle = fog; x.fillRect(0, 0, W, H);
    // the stone
    const sx = 330, sy = 70, sw = 540, sh = 520;
    const grad = x.createLinearGradient(sx, sy, sx + sw, sy + sh);
    grad.addColorStop(0, '#cfc8b8'); grad.addColorStop(1, '#a59e8e');
    x.fillStyle = grad;
    x.beginPath();
    x.moveTo(sx, sy + sh);
    x.lineTo(sx, sy + 170);
    x.bezierCurveTo(sx, sy - 40, sx + sw, sy - 40, sx + sw, sy + 170);
    x.lineTo(sx + sw, sy + sh);
    x.closePath();
    x.fill();
    x.fillStyle = '#1b2624'; x.fillRect(260, sy + sh - 6, 680, 70);
    // carving
    const counts = {};
    for (const g of r.ghosts) if (g.type !== 'locked') counts[g.type] = (counts[g.type] || 0) + 1;
    x.textAlign = 'center';
    x.fillStyle = '#3d3a33';
    x.font = '96px "IM Fell English", Georgia, serif';
    x.fillText('R.I.P.', W / 2, 210);
    x.font = '42px "IM Fell English", Georgia, serif';
    const host = hostOf(r.site);
    x.fillText(`${r.ghostCount} ghost${r.ghostCount === 1 ? '' : 's'} haunt${r.ghostCount === 1 ? 's' : ''}`, W / 2, 280);
    x.fillText(host.length > 26 ? host.slice(0, 25) + '…' : host, W / 2, 330);
    x.font = '28px "Atkinson Hyperlegible", system-ui, sans-serif';
    const lines = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([t, n]) => `${n} ${n === 1 ? PLURAL[t].replace(/s$/, '').replace(/ie$/, 'y').toLowerCase() : PLURAL[t].toLowerCase()}`);
    lines.forEach((l, i) => x.fillText(l, W / 2, 400 + i * 42));
    x.fillStyle = '#8ea5a4';
    x.font = '24px "Atkinson Hyperlegible", system-ui, sans-serif';
    x.fillText('Found by Graveyard Shift', W / 2, H - 22);
    c.toBlob((b) => b && download(b, `rip-${host}.png`), 'image/png');
  };
})();
