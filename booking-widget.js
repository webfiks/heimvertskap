(function(){
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbzvwGagefIei0jFGJDs4OdfhDCqbVCmQK1-d_HVmfJUYRBmeAsRy0zhDLZdTfa2jVd2/exec';
  var MO = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];
  var WD = ['Ma','Ti','On','To','Fr','Lø','Sø'];
  var DN = ['Søndag','Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag'];
  var SLOTS = ['12:00','14:00','16:00'];
  var STEPS = [1,2,4,5];

  var s = 1, sliding = false;
  var d = { addr:'', type:'', date:'', time:'', fornavn:'', etternavn:'', email:'', phone:'', msg:'' };
  var booked = {};

  var g = function(id) { return document.getElementById(id); };
  var ai = g('bw-addr'), dd = g('bw-dd');
  var mai = g('bw-mobile-addr'), mdd = g('bw-mobile-dd');
  var panel = g('bw-panel'), backdrop = g('bw-backdrop');

  var se = g('bw-steps'), nx = g('bw-nx'), bk = g('bw-bk'), pnav = g('bw-pnav'), okEl = g('bw-ok');
  var bkTop = g('bw-top-bar-back'), closeTop = g('bw-top-bar-close');
  var footer = g('bw-panel-footer');
  var timeInline = g('bw-time-inline');
  var track = g('bw-cal-track');
  var timeDateEl = g('bw-time-date'), tsEl = g('bw-ts');

  var cm = new Date(); cm.setDate(1);
  var td = new Date(); td.setHours(0,0,0,0);
  var selDate = null;

  // Progress dots (5 steps) — single element shared by desktop and mobile
  for (var i = 0; i < STEPS.length; i++) {
    var dot = document.createElement('div');
    dot.className = 'bw-dot' + (i === 0 ? ' active' : '');
    dot.dataset.idx = i;
    se.appendChild(dot);
  }

  // ── Panel open/close ──
  var isMobile = function() { return window.innerWidth <= 768; };
  var bwRoot = panel.parentElement; // original parent (.bw) for restoring on close

  function moveToBody() {
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
  }
  function moveBack() {
    bwRoot.appendChild(backdrop);
    bwRoot.appendChild(panel);
  }

  function openPanel(startStep) {
    if (isMobile()) { moveToBody(); document.body.style.overflow = 'hidden'; }
    panel.classList.add('open');
    backdrop.classList.add('open');
    ensureBookingsLoaded();
    var step = startStep || 2;
    s = step;
    goStep(step);
  }

  function openMobilePanel() {
    moveToBody();
    document.body.style.overflow = 'hidden';
    panel.classList.add('open');
    backdrop.classList.add('open');
    ensureBookingsLoaded();
    s = 1;
    goStep(1);
    // Focus synchronously within the user gesture so iOS opens the keyboard.
    mai.focus({ preventScroll: true });
  }

  function closePanel() {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    // Flytt tilbake etter at close-animasjonen er ferdig
    setTimeout(moveBack, 400);
  }

  backdrop.addEventListener('click', closePanel);
  if (closeTop) closeTop.addEventListener('click', closePanel);
  if (bkTop) bkTop.addEventListener('click', function() {
    var idx = STEPS.indexOf(s);
    if (idx > 0) goStep(STEPS[idx - 1]);
  });

  // ── Dynamic subtitles ──
  // Each step's subtitle mirrors what the user has already committed to.
  // Building this commitment chain raises the psychological cost of abandoning.
  var DEFAULT_SUBS = {
    2: 'Hva slags bolig ønsker du å leie ut?',
    4: 'Finn en dato og tid som passer deg.',
    5: 'Så vi kan sende deg en bekreftelse.'
  };
  function shortAddr() {
    // Just the street part (first comma-separated token) — full address is too long for a subtitle
    return (d.addr || '').split(',')[0].trim();
  }
  // Norwegian grammar varies by gender — map each housing type to its proper
  // definite form + possessive ("eneboligen din" vs "rekkehuset ditt").
  var TYPE_DEFINITE = {
    'Enebolig':  'eneboligen din',
    'Rekkehus':  'rekkehuset ditt',
    'Leilighet': 'leiligheten din',
    'Hytte':     'hytta di'
  };
  function updateSubtitle(n) {
    var subEl = document.querySelector('.bw-step[data-step="' + n + '"] .bw-step-sub');
    if (!subEl) return;
    var text = DEFAULT_SUBS[n] || '';
    if (n === 2 && d.addr) {
      text = 'Hva slags bolig vil du leie ut på ' + shortAddr() + '?';
    } else if (n === 4 && d.type && TYPE_DEFINITE[d.type]) {
      text = 'Når passer det å vise oss ' + TYPE_DEFINITE[d.type] + '?';
    } else if (n === 5 && d.date && d.time) {
      text = 'Vi sender bekreftelse for ' + d.date + ' kl. ' + d.time + '.';
    }
    subEl.textContent = text;
  }

  // ── Step navigation ──
  function goStep(n) {
    s = n;
    updateSubtitle(n);
    document.querySelectorAll('.bw-step').forEach(function(e) { e.classList.remove('active'); });
    var t = document.querySelector('.bw-step[data-step="' + n + '"]');
    if (t) t.classList.add('active');
    var idx = STEPS.indexOf(n);
    document.querySelectorAll('.bw-dot').forEach(function(e) {
      var v = +e.dataset.idx;
      e.className = 'bw-dot';
      if (v < idx) e.classList.add('done');
      if (v === idx) e.classList.add('active');
    });
    // Back button: on mobile show from step 2, on desktop hide on step 2
    var hideBack = isMobile() ? (n <= 1) : (n <= 2);
    bk.classList.toggle('hid', hideBack);
    if (bkTop) bkTop.classList.toggle('hid', hideBack);
    nx.textContent = n === 5 ? 'Book møte' : 'Neste';
    // Hide footer on step 1 (address step — selection auto-advances)
    footer.style.display = (n === 1) ? 'none' : '';
    if (n === 1) setTimeout(function() { mai.focus(); }, 100);
    if (n === 4) {
      if (d.date && selDate) {
        timeInline.hidden = false;
        timeDateEl.textContent = d.date;
        showTime();
      } else {
        timeInline.hidden = true;
      }
      // On mobile, build strip on first entry and scroll to selected
      if (isMobile()) {
        if (!stripBuilt) buildDateStrip();
        else syncDateSelection();
        requestAnimationFrame(function() { scrollStripToSelected(); });
      }
    }
    valStep();
  }

  function valStep() {
    var ok = false;
    switch (s) {
      case 1: ok = d.addr !== ''; break;
      case 2: ok = d.type !== ''; break;
      case 4:
        // Both date and time required (both are visible simultaneously)
        ok = d.date !== '' && d.time !== '';
        break;
      case 5: ok = true; break;
    }
    nx.disabled = !ok;
  }

  nx.addEventListener('click', function() {
    if (nx.disabled) return;
    // Step 5: submit form
    if (s === 5) { if (!g('bw-contact-form').reportValidity()) return; sub(); return; }
    var idx = STEPS.indexOf(s);
    if (idx < STEPS.length - 1) goStep(STEPS[idx + 1]);
  });
  bk.addEventListener('click', function() {
    var idx = STEPS.indexOf(s);
    if (idx > 0) goStep(STEPS[idx - 1]);
  });

  // ── Bookings ──
  var bookingsPromise = null;
  function ensureBookingsLoaded() {
    if (!bookingsPromise) bookingsPromise = loadBookings();
    return bookingsPromise;
  }

  async function loadBookings() {
    try {
      var res = await fetch(API);
      var arr = await res.json();
      if (Array.isArray(arr)) arr.forEach(function(b) {
        if (!b.dato || !b.tid) return;
        var dato = b.dato;
        if (dato.includes('T') || dato.includes('-')) {
          var dt = new Date(dato);
          if (!isNaN(dt)) dato = dt.getDate() + '. ' + MO[dt.getMonth()] + ' ' + dt.getFullYear();
        }
        booked[dato + '|' + b.tid] = true;
      });
      // Re-render calendars with updated booked state so users see conflicts
      rc();
      if (stripBuilt) { buildDateStrip(); syncDateSelection(); }
    } catch (e) {}
  }

  async function saveBooking() {
    booked[d.date + '|' + d.time] = true;
    var navn = (d.fornavn + ' ' + d.etternavn).replace(/\s+/g, ' ').trim();
    try {
      await fetch(API, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          // Soverom kept as empty string to preserve the existing Google Sheet's column shape.
          // The Soverom step was removed from the form; new rows will have a blank Soverom cell.
          Dato: d.date, Tid: d.time, Adresse: d.addr, Type: d.type,
          Soverom: '', Navn: navn, Epost: d.email, Telefon: d.phone, Melding: d.msg
        })
      });
    } catch (e) {}
  }

  // ── Address ──
  var st, ac;

  function dedup(parts) {
    var seen = {};
    return parts.filter(function(p) { var lc = p.toLowerCase().trim(); if (seen[lc]) return false; seen[lc] = true; return true; });
  }

  function searchKartverket(q, signal) {
    return fetch('https://ws.geonorge.no/adresser/v1/sok?sok=' + encodeURIComponent(q) + '&fuzzy=true&treffPerSide=6&asciiKompatibel=true', { signal: signal })
      .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function(res) {
        if (!res.adresser || !res.adresser.length) return null;
        return res.adresser.map(function(a) {
          // l1: street + number only. l2: deduped postnummer/poststed/kommunenavn.
          // full: saved to sheet — adressetekst + postnummer + poststed + kommunenavn.
          // "Norge" is intentionally excluded: the API only returns Norwegian addresses,
          // so including the country label is pure redundancy.
          return {
            l1: a.adressetekst || '',
            l2: dedup([a.postnummer, a.poststed, a.kommunenavn].filter(Boolean)).join(', '),
            full: dedup([a.adressetekst, a.postnummer, a.poststed, a.kommunenavn].filter(Boolean)).join(', ')
          };
        });
      });
  }

  // Pin-marker icon reused in both dropdowns
  var PIN_SVG = '<svg class="bw-di-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  function escAttr(s) { return String(s || '').replace(/"/g,'&quot;'); }

  function renderAddr(results) {
    if (!results || !results.length) { dd.innerHTML = '<div class="ekstra-liten-tekst" style="padding:16px;text-align:center;opacity:0.4;">Ingen treff</div>'; return; }
    dd.innerHTML = results.map(function(r) {
      return '<div class="bw-di" data-f="' + escAttr(r.full) + '">'
        + PIN_SVG
        + '<div class="bw-di-text">'
        +   '<p class="ekstra-liten-tekst bw-di-l1">' + r.l1 + '</p>'
        +   '<p class="ekstra-liten-tekst bw-di-l2">' + r.l2 + '</p>'
        + '</div>'
      + '</div>';
    }).join('');
    dd.querySelectorAll('.bw-di').forEach(function(item) {
      item.addEventListener('click', function() {
        ai.value = this.dataset.f;
        d.addr = this.dataset.f;
        dd.classList.remove('open');
        openPanel();
      });
    });
  }

  g('bw-inp-wrap').addEventListener('click', function(e) {
    if (isMobile()) {
      e.preventDefault();
      openMobilePanel();
    } else {
      ai.focus();
    }
  });

  ai.addEventListener('input', function() {
    // On mobile, don't handle inline input
    if (isMobile()) return;
    closePanel();
    clearTimeout(st); if (ac) ac.abort();
    var q = this.value.trim();
    if (q.length < 2) { dd.classList.remove('open'); dd.innerHTML = ''; d.addr = ''; return; }
    dd.innerHTML = '<div class="ekstra-liten-tekst" style="padding:16px;text-align:center;opacity:0.4;">Søker...</div>';
    dd.classList.add('open');
    st = setTimeout(function() {
      ac = new AbortController();
      searchKartverket(q, ac.signal)
        .then(renderAddr)
        .catch(function(e) { if (e.name !== 'AbortError') renderAddr(null); });
    }, 200);
  });

  ai.addEventListener('focus', function(e) {
    // On mobile, redirect to fullscreen panel
    if (isMobile()) { ai.blur(); openMobilePanel(); return; }
    // Desktop: if address was previously set, select all text
    if (d.addr && ai.value) ai.select();
    var q = ai.value.trim();
    if (q.length >= 2 && !panel.classList.contains('open')) {
      dd.innerHTML = '<div class="ekstra-liten-tekst" style="padding:16px;text-align:center;opacity:0.4;">Søker...</div>';
      dd.classList.add('open');
      clearTimeout(st); if (ac) ac.abort();
      st = setTimeout(function() {
        ac = new AbortController();
        searchKartverket(q, ac.signal)
          .then(renderAddr)
          .catch(function(e) { if (e.name !== 'AbortError') renderAddr(null); });
      }, 150);
    }
  });

  // ── Mobile address search (inside panel) ──
  var mst, mac;
  function renderMobileAddr(results) {
    if (!results || !results.length) { mdd.innerHTML = '<div class="ekstra-liten-tekst" style="padding:16px;text-align:center;opacity:0.4;">Ingen treff</div>'; return; }
    mdd.innerHTML = results.map(function(r) {
      return '<div class="bw-di" data-f="' + escAttr(r.full) + '">'
        + PIN_SVG
        + '<div class="bw-di-text">'
        +   '<p class="ekstra-liten-tekst bw-di-l1">' + r.l1 + '</p>'
        +   '<p class="ekstra-liten-tekst bw-di-l2">' + r.l2 + '</p>'
        + '</div>'
      + '</div>';
    }).join('');
    mdd.querySelectorAll('.bw-di').forEach(function(item) {
      item.addEventListener('click', function() {
        mai.value = this.dataset.f;
        ai.value = this.dataset.f;
        d.addr = this.dataset.f;
        mdd.classList.remove('open');
        goStep(2);
      });
    });
  }

  mai.addEventListener('input', function() {
    clearTimeout(mst); if (mac) mac.abort();
    var q = this.value.trim();
    if (q.length < 2) { mdd.classList.remove('open'); mdd.innerHTML = ''; d.addr = ''; return; }
    mdd.innerHTML = '<div class="ekstra-liten-tekst" style="padding:16px;text-align:center;opacity:0.4;">Søker...</div>';
    mdd.classList.add('open');
    mst = setTimeout(function() {
      mac = new AbortController();
      searchKartverket(q, mac.signal)
        .then(renderMobileAddr)
        .catch(function(e) { if (e.name !== 'AbortError') renderMobileAddr(null); });
    }, 200);
  });

  document.addEventListener('click', function(e) { if (!e.target.closest('.bw-aw') && !e.target.closest('.bw-panel')) dd.classList.remove('open'); });

  // ── Options ──
  function opts(id, key) {
    g(id).addEventListener('click', function(e) {
      var c = e.target.closest('.bw-opt');
      if (!c || c.classList.contains('sel')) return;
      this.querySelectorAll('.bw-opt').forEach(function(x) { x.classList.remove('sel'); });
      c.classList.add('sel');
      d[key] = c.dataset.value;
      valStep();
      // Auto-advance: tapping a card IS the commitment. Skip the redundant Neste tap.
      // Tilbake remains available on the next step for quick correction if user misclicked.
      var idx = STEPS.indexOf(s);
      if (idx < STEPS.length - 1) goStep(STEPS[idx + 1]);
    });
  }
  opts('bw-type', 'type');

  // ── Calendar ──
  function buildMonth(year, month) {
    var div = document.createElement('div'); div.className = 'bw-cal-m';
    var title = document.createElement('p');
    title.className = 'under-liten-tittel bw-cal-m-title';
    title.style.cssText = 'text-align:center;margin-bottom:12px;';
    title.textContent = MO[month] + ' ' + year;
    div.appendChild(title);
    var wg = document.createElement('div'); wg.className = 'bw-cw';
    for (var wi = 0; wi < WD.length; wi++) {
      var e = document.createElement('div');
      e.className = 'ekstra-liten-tekst';
      e.style.cssText = 'opacity:0.3;letter-spacing:0.05em;text-align:center;padding:4px;';
      e.textContent = WD[wi];
      wg.appendChild(e);
    }
    div.appendChild(wg);
    var dg = document.createElement('div'); dg.className = 'bw-cd';
    var f = new Date(year, month, 1).getDay(); var off = f === 0 ? 6 : f - 1; var tot = new Date(year, month + 1, 0).getDate();
    for (var i = 0; i < off; i++) { var emp = document.createElement('button'); emp.className = 'bw-d emp'; emp.disabled = true; dg.appendChild(emp); }
    var selDateStr = selDate ? selDate.toDateString() : null;
    var todayStr = td.toDateString();
    for (var j = 1; j <= tot; j++) {
      var b = document.createElement('button');
      b.className = 'bw-d ekstra-liten-tekst';
      b.textContent = j;
      var dt = new Date(year, month, j), dw = dt.getDay();
      if (dt <= td || dw === 0 || dw === 6) b.classList.add('dis');
      if (dt.toDateString() === todayStr) b.classList.add('tod');
      b.dataset.date = j + '. ' + MO[month] + ' ' + year;
      b.dataset.y = year; b.dataset.m = month; b.dataset.d = j;
      if (selDateStr && dt.toDateString() === selDateStr) b.classList.add('sel');
      dg.appendChild(b);
    }
    div.appendChild(dg); return div;
  }

  // Delegated click handler — one listener covers all months
  function handleDateClick(btn) {
    if (btn.classList.contains('dis') || btn.classList.contains('emp')) return;
    // Clear selection on both calendar cells and strip items
    document.querySelectorAll('.bw-d.sel, .bw-ds-item.sel').forEach(function(x) { x.classList.remove('sel'); });
    btn.classList.add('sel');
    var newDateStr = btn.dataset.date;
    var sameDate = (newDateStr === d.date);
    d.date = newDateStr;
    if (!sameDate) d.time = '';
    selDate = new Date(+btn.dataset.y, +btn.dataset.m, +btn.dataset.d);
    // Mirror selection to the OTHER picker so both stay in sync (calendar ↔ strip)
    syncDateSelection();
    showTime();
    valStep();
  }

  // Sync the currently selected date across both mobile strip and desktop/mobile calendars
  function syncDateSelection() {
    if (!d.date) return;
    document.querySelectorAll('.bw-d, .bw-ds-item').forEach(function(el) {
      if (el.dataset.date === d.date) el.classList.add('sel');
      else el.classList.remove('sel');
    });
  }

  // ── Mobile horizontal date strip ──
  var STRIP_DAYS = 60;           // number of dates to render in the strip
  var stripBuilt = false;

  function buildDateStrip() {
    var stripEl = g('bw-date-strip');
    if (!stripEl) return;
    stripEl.innerHTML = '';
    var base = new Date(); base.setHours(0,0,0,0);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < STRIP_DAYS; i++) {
      var dt = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      var dw = dt.getDay();
      var dateStr = dt.getDate() + '. ' + MO[dt.getMonth()] + ' ' + dt.getFullYear();
      // Disabled if today or past, weekend, or all slots already booked
      var allBooked = SLOTS.every(function(t) { return booked[dateStr + '|' + t]; });
      var disabled = (dt <= td) || (dw === 0 || dw === 6) || allBooked;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bw-ds-item';
      if (disabled) btn.classList.add('dis');
      if (dt.toDateString() === td.toDateString()) btn.classList.add('tod');
      if (selDate && dt.toDateString() === selDate.toDateString()) btn.classList.add('sel');
      btn.dataset.date = dateStr;
      btn.dataset.y = dt.getFullYear();
      btn.dataset.m = dt.getMonth();
      btn.dataset.d = dt.getDate();
      var circle = document.createElement('span');
      circle.className = 'bw-ds-circle';
      circle.textContent = dt.getDate();
      var wd = document.createElement('span');
      wd.className = 'bw-ds-wd';
      var wdShort = ['Søn','Man','Tir','Ons','Tor','Fre','Lør'];
      wd.textContent = wdShort[dw];
      btn.appendChild(circle);
      btn.appendChild(wd);
      frag.appendChild(btn);
    }
    stripEl.appendChild(frag);
    stripBuilt = true;
    updateStripMonthLabel();
  }

  // Update month label based on left-most visible date in strip
  function updateStripMonthLabel() {
    var stripEl = g('bw-date-strip');
    var labelEl = g('bw-strip-month');
    if (!stripEl || !labelEl) return;
    var scrollLeft = stripEl.scrollLeft;
    var items = stripEl.querySelectorAll('.bw-ds-item');
    for (var i = 0; i < items.length; i++) {
      if (items[i].offsetLeft + items[i].offsetWidth > scrollLeft + 8) {
        var y = +items[i].dataset.y, m = +items[i].dataset.m;
        labelEl.textContent = MO[m] + ' ' + y;
        return;
      }
    }
  }

  // Scroll strip so selected date is visible, or auto-select first available if none
  function scrollStripToSelected() {
    var stripEl = g('bw-date-strip');
    if (!stripEl) return;
    var sel = stripEl.querySelector('.bw-ds-item.sel');
    if (!sel) {
      // No selection: auto-select first non-disabled item and scroll to it
      var first = stripEl.querySelector('.bw-ds-item:not(.dis)');
      if (first) {
        stripEl.scrollLeft = Math.max(0, first.offsetLeft - 4);
        handleDateClick(first);
      }
      updateStripMonthLabel();
      return;
    }
    // Only scroll if the selected item is not fully inside the strip's visible viewport.
    // Avoids the jarring jump when today (or the chosen date) is already in view.
    var stripRect = stripEl.getBoundingClientRect();
    var selRect = sel.getBoundingClientRect();
    var fullyVisible = selRect.left >= stripRect.left - 1 && selRect.right <= stripRect.right + 1;
    if (!fullyVisible) {
      stripEl.scrollLeft = Math.max(0, sel.offsetLeft - 4);
    }
    updateStripMonthLabel();
  }

  // Wire up strip: click + scroll
  (function attachStripHandlers() {
    var stripEl = g('bw-date-strip');
    if (!stripEl) return;
    stripEl.addEventListener('click', function(e) {
      var btn = e.target.closest('.bw-ds-item');
      if (btn) handleDateClick(btn);
    });
    stripEl.addEventListener('scroll', function() {
      updateStripMonthLabel();
    }, { passive: true });
  })();

  function rc() {
    track.innerHTML = ''; track.classList.add('no-transition'); track.style.transform = 'translateX(0)';
    var y = cm.getFullYear(), m = cm.getMonth(); var nm = new Date(y, m + 1, 1);
    track.appendChild(buildMonth(y, m)); track.appendChild(buildMonth(nm.getFullYear(), nm.getMonth()));
    void track.offsetWidth; track.classList.remove('no-transition');
  }

  // Delegated click for desktop carousel track
  track.addEventListener('click', function(e) {
    var btn = e.target.closest('.bw-d');
    if (btn) handleDateClick(btn);
  });

  function isSingleMonth() { return window.innerWidth <= 700; }

  function slideNext() {
    if (sliding) return; sliding = true;
    var y = cm.getFullYear(), m = cm.getMonth(); var m3 = new Date(y, m + 2, 1);
    track.appendChild(buildMonth(m3.getFullYear(), m3.getMonth()));
    void track.offsetWidth;
    track.style.transform = isSingleMonth() ? 'translateX(-100%)' : 'translateX(calc(-50% - 27px))';
    track.addEventListener('transitionend', function h() { track.removeEventListener('transitionend', h); cm.setMonth(cm.getMonth() + 1); rc(); sliding = false; });
  }

  function slidePrev() {
    if (sliding) return;
    var test = new Date(cm.getFullYear(), cm.getMonth() - 1, 1);
    if (test < new Date(td.getFullYear(), td.getMonth(), 1)) return;
    sliding = true; var prev = new Date(cm.getFullYear(), cm.getMonth() - 1, 1);
    track.insertBefore(buildMonth(prev.getFullYear(), prev.getMonth()), track.firstChild);
    var offset = isSingleMonth() ? 'translateX(-100%)' : 'translateX(calc(-50% - 27px))';
    track.classList.add('no-transition'); track.style.transform = offset;
    void track.offsetWidth; track.classList.remove('no-transition'); track.style.transform = 'translateX(0)';
    track.addEventListener('transitionend', function h() { track.removeEventListener('transitionend', h); cm.setMonth(cm.getMonth() - 1); rc(); sliding = false; });
  }

  g('bw-cp').addEventListener('click', slidePrev);
  g('bw-cnn').addEventListener('click', slideNext);

  function showTime() {
    // Inline: show time picker below calendar
    timeInline.hidden = false;
    if (d.date) timeDateEl.textContent = d.date;
    var avail = SLOTS.filter(function(t) { return !booked[d.date + '|' + t]; });
    if (!avail.length) { tsEl.innerHTML = '<p class="ekstra-liten-tekst" style="opacity:0.4;text-align:center;padding:12px;">Ingen ledige tider</p>'; return; }
    var currentTime = d.time;
    tsEl.innerHTML = avail.map(function(t) {
      var end = (parseInt(t) + 1) + ':00';
      var sel = (t === currentTime) ? ' sel' : '';
      return '<button class="bw-tl-item ekstra-liten-tekst' + sel + '" data-t="' + t + '">' + t + ' – ' + end + '</button>';
    }).join('');
    tsEl.querySelectorAll('.bw-tl-item').forEach(function(b) {
      b.addEventListener('click', function() {
        if (this.classList.contains('sel')) return;
        tsEl.querySelectorAll('.bw-tl-item').forEach(function(x) { x.classList.remove('sel'); });
        this.classList.add('sel'); d.time = this.dataset.t; valStep();
        // Auto-advance: picking a time = picking the meeting. Skip Neste tap.
        var idx = STEPS.indexOf(s);
        if (idx < STEPS.length - 1) goStep(STEPS[idx + 1]);
      });
    });
  }

  // Render desktop carousel immediately (mobile uses date strip, built on step 4 entry)
  rc();

  // ── Contact ──
  ['bw-fornavn','bw-etternavn','bw-email','bw-phone','bw-msg'].forEach(function(id) {
    var e = g(id); if (!e) return;
    e.addEventListener('input', function() {
      d.fornavn = (g('bw-fornavn') || {}).value ? g('bw-fornavn').value.trim() : '';
      d.etternavn = (g('bw-etternavn') || {}).value ? g('bw-etternavn').value.trim() : '';
      d.email = g('bw-email').value.trim();
      d.phone = g('bw-phone').value.trim();
      d.msg = g('bw-msg').value.trim();
    });
  });

  // ── Submit ──
  async function sub() {
    nx.classList.add('bw-ld'); nx.disabled = true;
    await saveBooking();
    setTimeout(done, 800);
  }

  function resetForm() {
    // Clear all data
    d = { addr:'', type:'', date:'', time:'', fornavn:'', etternavn:'', email:'', phone:'', msg:'' };
    selDate = null;
    // Clear UI state
    ai.value = ''; if (mai) mai.value = '';
    document.querySelectorAll('.bw-opt.sel').forEach(function(x) { x.classList.remove('sel'); });
    document.querySelectorAll('.bw-d.sel').forEach(function(x) { x.classList.remove('sel'); });
    ['bw-fornavn','bw-etternavn','bw-email','bw-phone','bw-msg'].forEach(function(id) { var e = g(id); if (e) e.value = ''; });
    // Reset view back to step 2 (default for desktop)
    okEl.classList.remove('active');
    footer.style.display = '';
    se.style.display = '';
    if (timeInline) timeInline.hidden = true;
    goStep(2);
  }

  // OK close button — closes panel and resets form
  var okCloseBtn = g('bw-ok-close');
  if (okCloseBtn) {
    okCloseBtn.addEventListener('click', function() {
      closePanel();
      // Wait for close animation before resetting, so user doesn't see UI reset mid-animation
      setTimeout(resetForm, 400);
    });
  }

  function done() {
    nx.classList.remove('bw-ld');
    document.querySelectorAll('.bw-step').forEach(function(e) { e.classList.remove('active'); });
    footer.style.display = 'none'; se.style.display = 'none';
    okEl.classList.add('active');
    // Restart animations by removing .animate, forcing reflow, re-adding
    var stage = okEl.querySelector('.bw-ok-stage');
    if (stage) {
      stage.classList.remove('animate');
      void stage.offsetWidth;
      stage.classList.add('animate');
    }
    var navn = (d.fornavn + ' ' + d.etternavn).replace(/\s+/g, ' ').trim();
    g('bw-sum').innerHTML =
      '<div class="bw-sr"><span class="ekstra-liten-tekst bw-sr-lbl">Adresse</span><span class="ekstra-liten-tekst bw-sr-val">' + d.addr + '</span></div>' +
      '<div class="bw-sr"><span class="ekstra-liten-tekst bw-sr-lbl">Type</span><span class="ekstra-liten-tekst bw-sr-val">' + d.type + '</span></div>' +
      '<div class="bw-sr"><span class="ekstra-liten-tekst bw-sr-lbl">Møte</span><span class="ekstra-liten-tekst bw-sr-val">' + d.date + ' kl. ' + d.time + '</span></div>' +
      '<div class="bw-sr"><span class="ekstra-liten-tekst bw-sr-lbl">Navn</span><span class="ekstra-liten-tekst bw-sr-val">' + navn + '</span></div>';
  }
})();
