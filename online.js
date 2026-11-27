/* Mode online (Supabase). Aktif hanya jika config.js diisi. */
(function () {
var C = window.SAPALOKA_CONFIG || {};
var URL_ = String(C.url || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, ''), KEY_ = String(C.key || '').trim();
if (!URL_ && !KEY_) return;
var localRender = render, localSend = send, localBack = act.back, localTab = act.tab, localGoBack = window.goBack;
var SKEY = 'sapaloka-session';

function isSecret(k) {
  if (k.indexOf('sb_secret') === 0) return true;
  try { return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch (e) { return false; }
}
var problem = isSecret(KEY_) ? 'config.js berisi kunci RAHASIA. Hapus segera, ganti dengan Publishable key, dan buat ulang kunci rahasia di Supabase.'
  : !/^https:\/\/[^\s\/]+$/.test(URL_) || !KEY_ ? 'config.js belum benar. url harus diawali https:// dan key tidak boleh kosong.' : '';

var FIELDS = 'id,username,name,bio,avatar,last_seen';
var feed = [], stories = [], changed = '1970-01-01T00:00:00Z', marking = false, ticks = 0;
var ICON = {
  heart: '<path d="M12 20S4 15 4 9.5C4 6.5 6.2 5 8.3 5c1.7 0 3 1 3.7 2.3C12.700 6 14 5 15.7 5 17.800 5 20 6.500 20 9.500 20 15 12 20 12 20z"/>',
  talk: '<path d="M12 4c5 0 8.500 3.2 8.500 7.500S17 19 12 19c-1 0-2-.1-2.9-.4L4 20l1.5-3.8C4.2 14.9 3.500 13.3 3.500 11.500 3.500 7.2 7 4 12 4z"/>',
  on: '<path d="M4 9.500h3.500L12 6v12l-4.500-3.500H4zM15.500 9a4 4 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/>',
  off: '<path d="M4 9.500h3.500L12 6v12l-4.500-3.500H4zM16 9.500l5 5M21 9.500l-5 5"/>',
  send: '<path d="M21 4L3 11l7 3 3 7zM10 14L21 4"/>',
  trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>'
};
function icon(n) { return '<svg viewBox="0 0 24 24">' + ICON[n] + '</svg>'; }
var css = document.createElement('style');
css.textContent = '#nav button,#nav button:focus{outline:none;-webkit-tap-highlight-color:transparent}#lens{transition:transform .38s cubic-bezier(.3,1.15,.5,1),scale .22s}' +
  'body.vmode header{position:absolute;top:0;left:0;right:0;z-index:2;background:linear-gradient(rgba(0,0,0,.6),transparent);border:0;color:#fff}body.vmode header button{background:rgba(255,255,255,.18);color:#fff;border:0}' +
  '.rail{position:absolute;right:10px;bottom:100px;display:flex;flex-direction:column;gap:14px;align-items:center}.rail button{color:#fff;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;text-shadow:0 1px 4px #000}' +
  '.rail svg{width:30px;height:30px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 3px rgba(0,0,0,.7))}.rail .liked svg{fill:#ff4d6d;stroke:#ff4d6d}' +
  '.who{display:flex;gap:8px;align-items:center;color:#fff;font-weight:700}.who .av{width:36px;height:36px}' +
  '.vbar{position:absolute;left:0;right:0;bottom:88px;height:3px;background:rgba(255,255,255,.25)}.vbar i{display:block;height:100%;width:0;background:#fff}' +
  '.burst{position:absolute;left:50%;top:45%;width:110px;height:110px;margin:-55px;pointer-events:none;animation:burst .8s forwards}.burst svg{width:100%;height:100%;fill:#ff4d6d;stroke:none}' +
  '@keyframes burst{0%{transform:scale(.2);opacity:0}30%{transform:scale(1.2);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1) translateY(-50px);opacity:0}}' +
  '#sheet{position:fixed;left:0;right:0;bottom:0;max-width:600px;margin:auto;height:68%;z-index:4;background:var(--card);color:var(--text);border-radius:20px 20px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.5);display:flex;flex-direction:column}' +
  '#sheet.full{height:100%;border-radius:0;background:#000;color:#fff}#sheet.full video{flex:1;min-height:0;width:100%}#clist{flex:1;overflow-y:auto}' +
  '.stats{display:flex;gap:28px}.stats b{display:block;font-size:18px}.emo{display:flex;justify-content:space-around;padding:6px 8px 0}.emo button{font-size:24px}.m.big{font-size:40px;background:none;border:0}' +
  '.m .meta{display:flex;justify-content:flex-end;align-items:center;gap:6px;color:var(--muted);font-size:11px}.meta .read{color:#2f9bff;font-weight:700}.meta button{color:var(--muted);padding:0 4px;font-size:16px;line-height:1}' +
  '.quote{border-left:3px solid var(--accent);padding:2px 8px;margin-bottom:4px;font-size:13px;color:var(--muted);max-height:40px;overflow:hidden}.gone{font-style:italic;color:var(--muted)}' +
  '.badge{background:var(--accent);color:var(--on);border-radius:12px;min-width:22px;text-align:center;font-size:12px;font-weight:700;padding:2px 6px}header .sub{display:block;font-size:12px;font-weight:400;color:var(--muted)}' +
  '.post .acts svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linejoin:round;vertical-align:middle}.post .acts button{display:flex;gap:5px;align-items:center}.post .acts .liked svg{fill:#ff4d6d;stroke:#ff4d6d}' +
  '.grid img{display:block;width:100%;aspect-ratio:1;object-fit:cover}#sheet.full img{flex:1;min-height:0;width:100%;object-fit:contain}' +
  '.grid video{width:100%;aspect-ratio:3/4;object-fit:cover;background:#000;pointer-events:none}.grid button{display:block}';
document.head.appendChild(css);
var comments = null, tapTimer = 0;
var session = null, me = null, people = {}, msgs = [], lastId = 0, online = [], gen = 0, polling = false, signup = false, busy = false, vstate = '';
try { session = JSON.parse(localStorage.getItem(SKEY)); } catch (e) {}
function keepSession(s) {
  session = s ? { token: s.access_token, refresh: s.refresh_token, uid: s.user.id, exp: Date.now() + s.expires_in * 1000 } : null;
  if (session) localStorage.setItem(SKEY, JSON.stringify(session)); else localStorage.removeItem(SKEY);
}
function clearData() { closeSheet(); view.prof = null; clearTimeout(tapTimer); gen++; me = null; people = {}; msgs = []; lastId = 0; feed = []; stories = []; changed = '1970-01-01T00:00:00Z'; marking = false; view.reply = null; online = []; polling = false; vstate = ''; view.peer = null; }
function logout() { stopRec(false); keepSession(null); clearData(); view = { tab: 'chat', chat: null }; render(); }

function call(path, o) {
  o = o || {};
  var h = { apikey: KEY_ };
  if (o.token) h.Authorization = 'Bearer ' + o.token;
  if (o.type) h['Content-Type'] = o.type; else if (o.json !== undefined) h['Content-Type'] = 'application/json';
  if (o.prefer) h.Prefer = o.prefer;
  return fetch(URL_ + path, { method: o.method || 'GET', headers: h, body: o.json !== undefined ? JSON.stringify(o.json) : o.body })
    .then(function (r) {
      return r.text().then(function (t) {
        var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) { var err = new Error((d && (d.msg || d.message || d.error_description || d.error)) || 'Server menolak (' + r.status + ')'); err.status = r.status; throw err; }
        return d;
      });
    }, function () { throw new Error('Tidak bisa terhubung. Cek internet dan alamat server.'); });
}
var refreshing = null;
function api(path, o) {
  var g = gen;
  function go() { if (g !== gen || !session) throw new Error('Sesi berakhir'); o = o || {}; o.token = session.token; return call(path, o).then(function (d) { if (g !== gen) throw new Error('Sesi berakhir'); return d; }); }
  if (!session) return Promise.reject(new Error('Belum masuk'));
  if (session.exp - Date.now() > 60000) return Promise.resolve().then(go);
  if (!refreshing) {
    var p = call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', json: { refresh_token: session.refresh } })
      .then(function (s) { if (g === gen) keepSession(s); }, function (e) { if (g === gen && (e.status === 400 || e.status === 401 || e.status === 403)) { logout(); toast('Silakan masuk lagi'); } throw e; });
    refreshing = p;
    var done = function () { refreshing = null; };
    p.then(done, done);
  }
  return refreshing.then(go);
}
function fail(e) { if (e.message !== 'Sesi berakhir') toast(e.message); }

function start() {
  var g = gen;
  api('/rest/v1/profiles?select=' + FIELDS + '&id=eq.' + session.uid).then(function (r) {
    if (!r.length) { logout(); toast('Profil tidak ditemukan. Daftar ulang.'); return; }
    me = r[0]; people[me.id] = me; render(); poll(); ping();
    api('/rest/v1/posts?owner=eq.' + me.id + '&story=is.true&created_at=lt.' + encodeURIComponent(new Date(Date.now() - 864e5).toISOString()), { method: 'DELETE' }).catch(function () {});
  }).catch(function (e) { if (g !== gen) return; if (/(bio|avatar|last_seen).*does not exist/.test(e.message)) e = new Error('Server belum diperbarui. Jalankan schema-4.sql di Supabase.'); fail(e); setTimeout(function () { if (g === gen && !me) start(); }, 5000); });
}
function poll() {
  if (!me || polling || document.hidden) return;
  polling = true; var g = gen, first = !lastId;
  api('/rest/v1/messages?select=*&order=id.' + (first ? 'desc&limit=100' : 'asc&limit=50&id=gt.' + lastId)).then(function (r) {
    if (first) { r.reverse(); r.forEach(function (m) { if (m.updated_at > changed) changed = m.updated_at; }); }
    var need = [];
    r.forEach(function (m) { var o = other(m); if (!people[o] && need.indexOf(o) < 0) need.push(o); });
    var p = need.length ? api('/rest/v1/profiles?select=' + FIELDS + '&id=in.(' + need.join(',') + ')').then(function (l) { l.forEach(function (x) { people[x.id] = x; }); }) : Promise.resolve();
    return p.then(function () { add(r); markRead(); return updates(); });
  }).catch(fail).then(function () { if (g === gen) polling = false; });
}
function updates() {
  return api('/rest/v1/messages?select=id,read_at,deleted,updated_at&order=updated_at.asc&limit=500&updated_at=gte.' + encodeURIComponent(changed)).then(function (r) {
    var dirty = false;
    r.forEach(function (u) {
      changed = u.updated_at;
      msgs.forEach(function (m) { if (m.id === u.id && (m.read_at !== u.read_at || m.deleted !== u.deleted)) { m.read_at = u.read_at; m.deleted = u.deleted; if (u.deleted) m.body = '-'; dirty = true; } });
    });
    if (dirty) refresh();
  });
}
function refresh() {
  if (view.peer) { var box = $('#msgs'), m = $('main'); if (!box) return; var end = m.scrollHeight - m.scrollTop - m.clientHeight < 60; box.innerHTML = thread(); if (end) m.scrollTop = m.scrollHeight; }
  else if (view.tab === 'chat' && !view.prof) render();
}
function unread(id) { return msgs.filter(function (m) { return m.sender === id && m.recipient === me.id && !m.read_at && !m.deleted; }).length; }
function markRead() {
  var id = view.peer; if (!id || marking || document.hidden || !unread(id)) return;
  marking = true; var g = gen;
  api('/rest/v1/rpc/mark_read', { method: 'POST', json: { peer: id } }).then(function () {
    msgs.forEach(function (m) { if (m.sender === id && !m.read_at) m.read_at = new Date().toISOString(); });
  }).catch(fail).then(function () { if (g === gen) marking = false; });
}
function ping() { if (me && !document.hidden) api('/rest/v1/rpc/ping', { method: 'POST', json: { visible: !S.hideSeen } }).catch(function () {}); }
function seen(p) {
  if (!p.last_seen) return '';
  var t = Date.parse(p.last_seen);
  return Date.now() - t < 75000 ? 'online' : 'terakhir dilihat ' + date(t);
}
function peerStatus() {
  var id = view.peer; if (!id || !me || document.hidden) return;
  api('/rest/v1/profiles?select=' + FIELDS + '&id=eq.' + id).then(function (l) { if (!l.length) return; people[id] = l[0]; var e = $('#seen'); if (e && view.peer === id) e.textContent = seen(l[0]); }).catch(function () {});
}
function other(m) { return m.sender === me.id ? m.recipient : m.sender; }
function add(r) {
  if (!r.mine) r.forEach(function (m) { if (m.id > lastId) lastId = m.id; });
  var fresh = r.filter(function (m) { return !msgs.some(function (x) { return x.id === m.id; }); });
  if (!fresh.length) return;
  msgs = msgs.concat(fresh).sort(function (a, b) { return a.id - b.id; });
  if (view.peer) { var box = $('#msgs'); if (box) { box.innerHTML = thread(); $('main').scrollTop = $('main').scrollHeight; } markRead(); }
  else if (view.tab === 'chat' && !view.prof) render();
}
function body(m) {
  if (m.kind === 'photo') return /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(m.body) ? '<img alt="Foto" src="' + m.body + '">' : '[Foto tidak didukung]';
  if (m.kind === 'audio') return /^data:audio\/mp4;base64,[A-Za-z0-9+\/=]+$/.test(m.body) ? '<audio controls src="' + m.body + '"></audio>' : '[Suara tidak didukung]';
  return esc(m.body);
}
function face(p, cls) { return av(p.name, /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(p.avatar || '') ? p.avatar : '', cls); }
function big(m) { return m.kind === 'text' && m.body.length <= 8 && !/[A-Za-z0-9<>&.,?!]/.test(m.body) && /[^\u0000-\u2000]/.test(m.body); }
function short(m) { return m.deleted ? 'Pesan dihapus' : m.kind === 'text' ? m.body : m.kind === 'photo' ? '[Foto]' : '[Pesan suara]'; }
function byId(id) { return msgs.filter(function (m) { return String(m.id) === String(id); })[0]; }
function thread() {
  return msgs.filter(function (m) { return other(m) === view.peer; }).map(function (m) {
    var mine = m.sender === me.id, q = m.reply_to && byId(m.reply_to);
    return '<div class="m ' + (mine ? 'me' : '') + (!m.deleted && big(m) ? ' big' : '') + '">' + (m.reply_to && !m.deleted ? '<div class="quote">' + esc(q ? short(q) : 'Pesan lama') + '</div>' : '') +
      (m.deleted ? '<span class="gone">Pesan dihapus</span>' : body(m)) + '<div class="meta"><span>' + time(Date.parse(m.created_at)) + '</span>' +
      (mine && !m.deleted ? '<span class="' + (m.read_at ? 'read' : '') + '" aria-label="' + (m.read_at ? 'Dibaca' : 'Terkirim') + '">' + (m.read_at ? '\u2713\u2713' : '\u2713') + '</span>' : '') +
      (m.deleted ? '' : '<button data-a="omsg" data-id="' + m.id + '" aria-label="Opsi pesan">\u22EE</button>') + '</div></div>';
  }).join('') || '<p class="muted">Belum ada pesan.</p>';
}
function personRow(p, sub, action, count) {
  return '<button class="row" data-a="' + (action || 'opeer') + '" data-id="' + esc(p.id) + '">' + face(p) + '<span class="grow"><b>@' + esc(p.username) + '</b><div class="muted cut">' + esc(sub) + '</div></span>' + (count ? '<span class="badge">' + count + '</span>' : '') + '</button>';
}
function vurl(p) { return URL_ + '/storage/v1/object/public/videos/' + p.split('/').map(encodeURIComponent).join('/'); }

render = function () {
  var h = $('header'), m = $('main'), f = $('#foot'), nv = $('#nav');
  var vmode = !!session && !!me && !problem && !view.peer && !view.prof && view.tab === 'video';
  document.body.className = (S.dark ? 'dark' : '') + (vmode ? ' vmode' : '');
  vstate = '';
  if (!vmode && watcher) { watcher.disconnect(); watcher = null; }
  if (problem) { nv.hidden = true; f.innerHTML = ''; h.innerHTML = '<h1>Sapaloka</h1>'; m.className = ''; m.innerHTML = '<div class="center">' + esc(problem) + '</div>'; return; }
  if (!session) {
    nv.hidden = true; f.innerHTML = ''; m.className = ''; h.innerHTML = '<h1>' + (signup ? 'Daftar' : 'Masuk') + ' Sapaloka</h1>';
    m.innerHTML = '<form class="pad" data-f="oauth" style="display:flex;flex-direction:column;gap:12px">' +
      (signup ? '<label>Username<input type="text" id="ou" maxlength="20" autocapitalize="none" autocomplete="off"></label>' : '') +
      '<label>Email<input type="text" id="oe" inputmode="email" autocapitalize="none"></label><label>Kata sandi (minimal 8)<input type="password" id="op" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px"></label>' +
      '<button class="btn">' + (signup ? 'Daftar' : 'Masuk') + '</button><button type="button" class="ghost" data-a="oswitch">' + (signup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar') + '</button></form>';
    return;
  }
  if (!me) { nv.hidden = true; f.innerHTML = ''; m.innerHTML = '<div class="center">Menghubungkan...<button class="ghost" data-a="ologout">Keluar</button></div>'; h.innerHTML = '<h1>Sapaloka</h1>'; return; }
  if (watcher) { watcher.disconnect(); watcher = null; }
  if (view.peer) {
    var p = people[view.peer];
    nv.hidden = true; m.className = '';
    h.innerHTML = '<button data-a="back" aria-label="Kembali">&#8592;</button>' + face(p) + '<h1 data-a="oprof" data-id="' + esc(p.id) + '">@' + esc(p.username) + '<span class="sub" id="seen">' + esc(seen(p)) + '</span></h1><button class="danger" data-a="oblock" data-id="' + esc(p.id) + '">Blokir</button>';
    var old = $('#msg'), val = old ? old.value : '';
    m.innerHTML = '<div id="msgs">' + thread() + '</div>';
    var rq = view.reply && byId(view.reply);
    f.innerHTML = (rq ? '<div class="row"><span class="grow quote">' + esc(short(rq)) + '</span><button data-a="onoreply" aria-label="Batal balas">\u2715</button></div>' : '') + (rec ? '' : '<div class="emo">' + ['\uD83D\uDE02', '\u2764\uFE0F', '\uD83D\uDC4D', '\uD83D\uDD25', '\uD83D\uDE2D', '\uD83D\uDE4F'].map(function (x) { return '<button data-a="oemoji" data-id="' + x + '" aria-label="Kirim ' + x + '">' + x + '</button>'; }).join('') + '</div>') + (rec ? '<div class="form"><button class="ghost" data-a="reccancel">Batal</button><span class="rec">&#9679; Merekam <span id="sec">' + Math.round((Date.now() - rec.at) / 1000) + '</span> dtk</span><button class="btn" data-a="recsend">Kirim</button></div>'
      : '<form class="form" data-f="osend"><button type="button" class="ico" data-a="sendphoto">Foto</button><button type="button" class="ico" data-a="record" aria-label="Rekam pesan suara">VN</button><input type="text" id="msg" maxlength="4000" placeholder="Tulis pesan" aria-label="Pesan" autocomplete="off"><button class="btn">Kirim</button></form>');
    if ($('#msg')) $('#msg').value = val;
    m.scrollTop = m.scrollHeight; return;
  }
  f.innerHTML = ''; nv.hidden = false; nv.className = view.tab === 'video' ? 'onvideo' : ''; m.className = view.tab === 'video' ? '' : 'pad-nav';
  moveLens(index(view.tab));
  if (view.prof) { m.className = 'pad-nav'; profilePage(view.prof); return; }
  if (view.tab === 'chat') {
    h.innerHTML = '<h1>Sapaloka</h1><button class="btn" data-a="tab" data-id="search">+ Obrolan</button>';
    var last = {}; msgs.forEach(function (x) { last[other(x)] = x; });
    m.innerHTML = Object.keys(last).sort(function (a, b) { return last[b].id - last[a].id; }).map(function (id) {
      var x = last[id]; return people[id] ? personRow(people[id], short(x), 'opeer', unread(id)) : '';
    }).join('') || '<div class="center">Belum ada obrolan. Cari teman lewat username.</div>';
  } else if (view.tab === 'search') {
    h.innerHTML = '<h1>Cari</h1>';
    m.innerHTML = '<div class="pad"><input type="text" id="q" placeholder="Cari username" aria-label="Cari username" autocapitalize="none" autocomplete="off"></div><div id="res"><div class="center muted">Ketik minimal 2 huruf.</div></div>';
    var t, n = 0;
    $('#q').oninput = function () {
      var q = this.value.toLowerCase().replace(/[^a-z0-9._]/g, ''), k = ++n; clearTimeout(t); if (q.length < 2) return;
      t = setTimeout(function () {
        api('/rest/v1/profiles?select=' + FIELDS + '&limit=20&id=neq.' + me.id + '&username=ilike.' + encodeURIComponent(q) + '*').then(function (l) {
          var box = $('#res'); if (k !== n || !box) return;
          online = l; box.innerHTML = l.map(function (p) { people[p.id] = p; return personRow(p, p.name, 'oprof'); }).join('') || '<div class="center muted">Tidak ditemukan.</div>';
        }).catch(fail);
      }, 400);
    };
  } else if (view.tab === 'video') {
    h.innerHTML = '<h1>Video</h1><button class="ghost" data-a="orefresh">Muat ulang</button><button class="btn" data-a="newvideo">+ Video</button>';
    m.innerHTML = '<div class="center muted">Memuat...</div>'; loadOnline();
  } else if (view.tab === 'feed') {
    h.innerHTML = '<h1>Beranda</h1><button class="ghost" data-a="orefresh">Muat ulang</button><button class="btn" data-a="newpost">+ Foto</button>';
    m.innerHTML = '<div class="center muted">Memuat...</div>'; loadFeed();
  } else {
    profilePage(me.id);
  }
};
var POST = 'id,owner,image,caption,created_at,profiles(username,name,avatar),post_likes(user_id),post_comments(id)';
function safe(src) { return /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(src) ? src : ''; }
function postCard(p) {
  var liked = p.post_likes.some(function (x) { return x.user_id === me.id; });
  return '<article class="post"><div class="row"><button class="grow" style="display:flex;gap:10px;align-items:center;text-align:left" data-a="oprof" data-id="' + esc(p.owner) + '">' + face(p.profiles) + '<span><b>@' + esc(p.profiles.username) + '</b><div class="muted">' + date(Date.parse(p.created_at)) + '</div></span></button>' +
    (p.owner === me.id ? '<button class="danger" data-a="odelpost" data-id="' + p.id + '">Hapus</button>' : '<button data-a="opostmore" data-id="' + p.id + '" aria-label="Lainnya">\u22EF</button>') + '</div><img alt="Foto unggahan" src="' + safe(p.image) + '"><div class="pad"><div class="acts"><button class="' + (liked ? 'liked' : '') + '" data-a="oplike" data-id="' + p.id + '" aria-label="Suka">' + icon('heart') + '<small>' + p.post_likes.length + '</small></button><button data-a="opcomments" data-id="' + p.id + '" aria-label="Komentar">' + icon('talk') + '<small>' + p.post_comments.length + '</small></button></div><p style="overflow-wrap:anywhere">' + esc(p.caption) + '</p></div></article>';
}
function loadFeed(before) {
  var ticket = vstate = String(Math.random());
  var reqs = [api('/rest/v1/posts?select=' + POST + '&story=is.false&order=id.desc&limit=8' + (before ? '&id=lt.' + before : ''))];
  if (!before) reqs.push(api('/rest/v1/posts?select=id,owner,created_at,profiles(username,name,avatar)&story=is.true&order=id.desc&limit=60&created_at=gt.' + encodeURIComponent(new Date(Date.now() - 864e5).toISOString())));
  Promise.all(reqs).then(function (r) {
    if (ticket !== vstate || view.tab !== 'feed' || view.peer || view.prof) return;
    feed = before ? feed.concat(r[0]) : r[0]; if (!before) stories = r[1];
    var owners = []; stories.forEach(function (x) { if (owners.indexOf(x.owner) < 0) owners.push(x.owner); });
    $('main').innerHTML = '<div class="stories"><button data-a="newstory"><span class="ring"><span class="av">+</span></span>Cerita</button>' + owners.map(function (o) {
      var x = stories.filter(function (y) { return y.owner === o; })[0];
      return '<button data-a="ostory" data-id="' + esc(o) + '"><span class="ring new">' + face(x.profiles) + '</span><span class="cut" style="max-width:64px">' + esc(x.profiles.username) + '</span></button>';
    }).join('') + '</div>' + (feed.map(postCard).join('') || '<div class="center">Belum ada foto. Unggah yang pertama.</div>') +
      (r[0].length === 8 ? '<div class="center"><button class="ghost" data-a="omorefeed" data-id="' + r[0][7].id + '">Muat lebih banyak</button></div>' : '');
  }).catch(function (e) { fail(e); if (ticket === vstate && !before && view.tab === 'feed' && !view.peer) $('main').innerHTML = '<div class="center">Gagal memuat Beranda.</div>'; });
}
function upload(story) {
  pick(function (img) {
    modal(story ? 'Keterangan cerita (boleh kosong), terlihat 24 jam' : 'Keterangan foto (semua pengguna bisa melihat)', function (t) {
      if (busy) { toast('Tunggu unggahan sebelumnya'); return; }
      busy = true; toast('Mengunggah...');
      api('/rest/v1/posts', { method: 'POST', json: { image: img, caption: t.slice(0, 300), story: story } }).then(function () { toast(story ? 'Cerita terunggah' : 'Foto terunggah'); if (view.tab === 'feed' && !view.peer && !view.prof) render(); }).catch(fail).then(function () { busy = false; });
    }, true);
  });
}
act.newpost = function () { upload(false); };
act.newstory = function () { upload(true); };
act.omorefeed = function (id) { var b = document.querySelector('[data-a=omorefeed]'); b.disabled = true; loadFeed(Number(id)); };
function post(id) { return feed.filter(function (x) { return String(x.id) === String(id); })[0]; }
act.oplike = function (id) {
  var p = post(id); if (!p || liking['p' + id]) return;
  var before = p.post_likes.slice(), on = !before.some(function (x) { return x.user_id === me.id; });
  function paint() { var b = document.querySelector('[data-a=oplike][data-id="' + p.id + '"]'); if (!b) return; b.className = p.post_likes.some(function (x) { return x.user_id === me.id; }) ? 'liked' : ''; b.querySelector('small').textContent = p.post_likes.length; }
  p.post_likes = on ? before.concat({ user_id: me.id }) : before.filter(function (x) { return x.user_id !== me.id; }); paint(); liking['p' + id] = true;
  (on ? api('/rest/v1/post_likes', { method: 'POST', json: { post_id: p.id } }) : api('/rest/v1/post_likes?post_id=eq.' + p.id + '&user_id=eq.' + me.id, { method: 'DELETE' }))
    .catch(function (e) { if (e.status !== 409) { p.post_likes = before; paint(); fail(e); } }).then(function () { delete liking['p' + id]; });
};
act.odelpost = function (id) { if (confirm('Hapus foto ini?')) api('/rest/v1/posts?id=eq.' + Number(id), { method: 'DELETE' }).then(function () { closeSheet(); render(); }).catch(fail); };
act.opostmore = function (id) {
  var p = post(id); if (!p) return;
  openSheet('<div class="center"><button class="ghost" data-a="opreport" data-id="' + p.id + '">Laporkan foto</button><button class="ghost danger" data-a="oblock" data-id="' + esc(p.owner) + '">Blokir pengguna</button><button class="ghost" data-a="oclose">Batal</button></div>').style.height = 'auto';
};
act.opreport = function (id) { api('/rest/v1/post_reports', { method: 'POST', json: { post_id: Number(id) } }).then(function () { closeSheet(); toast('Laporan terkirim'); }).catch(fail); };
function showStory(list, i) {
  var x = list[i]; if (!x) { closeSheet(); return; }
  var e = openSheet('<div class="row"><b class="grow">@' + esc(x.profiles.username) + ' \u00B7 ' + time(Date.parse(x.created_at)) + ' (' + (i + 1) + '/' + list.length + ')</b><button data-a="oclose">Tutup</button></div><div class="center muted">Memuat...</div>', 'full');
  api('/rest/v1/posts?select=image,caption&id=eq.' + x.id).then(function (r) {
    if ($('#sheet') !== e || !r.length) return;
    e.removeChild(e.lastChild);
    e.insertAdjacentHTML('beforeend', '<img alt="Cerita" src="' + safe(r[0].image) + '"><p class="pad">' + esc(r[0].caption) + '</p><div class="row">' + (x.owner === me.id ? '<button data-a="odelpost" data-id="' + x.id + '">Hapus</button>' : '<button data-a="opeer" data-id="' + esc(x.owner) + '">Balas lewat chat</button>') + '<span class="grow"></span><button class="btn" id="next">' + (i + 1 < list.length ? 'Berikutnya' : 'Selesai') + '</button></div>');
    $('#next').onclick = function () { showStory(list, i + 1); };
  }).catch(function (err) { fail(err); closeSheet(); });
}
act.ostory = function (owner) { showStory(stories.filter(function (x) { return x.owner === owner; }).reverse(), 0); };
act.ophoto = function (id) {
  var e = openSheet('<button class="pad" data-a="oclose">&#8592; Tutup</button>', 'full');
  api('/rest/v1/posts?select=image,caption&id=eq.' + Number(id)).then(function (r) { if ($('#sheet') === e && r.length) e.insertAdjacentHTML('beforeend', '<img alt="Foto" src="' + safe(r[0].image) + '"><p class="pad">' + esc(r[0].caption) + '</p>'); }).catch(fail);
};
act.opcomments = function (id) { commentSheet('post', id); };
act.omsg = function (id) {
  var m = byId(id); if (!m) return;
  openSheet('<div class="center"><button class="ghost" data-a="oreply" data-id="' + m.id + '">Balas</button>' + (m.sender === me.id ? '<button class="ghost danger" data-a="odelmsg" data-id="' + m.id + '">Hapus untuk semua</button>' : '') + '<button class="ghost" data-a="oclose">Batal</button></div>').style.height = 'auto';
};
act.oreply = function (id) { closeSheet(); view.reply = Number(id); render(); $('#msg') && $('#msg').focus(); };
act.onoreply = function () { view.reply = null; render(); };
act.odelmsg = function (id) {
  closeSheet(); if (!confirm('Hapus pesan ini untuk semua?')) return;
  api('/rest/v1/rpc/delete_message', { method: 'POST', json: { mid: Number(id) } }).then(function () { var m = byId(id); if (m) { m.deleted = true; m.body = '-'; } refresh(); }).catch(fail);
};
act.ohideseen = function () { commit(function () { S.hideSeen = !S.hideSeen; }); ping(); render(); };
function profilePage(id) {
  var h = $('header'), m = $('main'), own = id === me.id, ticket = vstate = String(Math.random());
  h.innerHTML = (view.prof ? '<button data-a="back" aria-label="Kembali">&#8592;</button>' : '') + '<h1>Profil</h1>' + (own && !view.prof ? '<button class="ghost" data-a="dark">' + (S.dark ? 'Terang' : 'Gelap') + '</button>' : '');
  m.innerHTML = '<div class="center muted">Memuat...</div>';
  var q = encodeURIComponent(id);
  Promise.all([api('/rest/v1/profiles?select=' + FIELDS + '&id=eq.' + q),
    api('/rest/v1/follows?select=follower,followed&or=(follower.eq.' + q + ',followed.eq.' + q + ')'),
    api('/rest/v1/videos?select=id,path,caption,owner&owner=eq.' + q + '&order=id.desc&limit=30'),
    api('/rest/v1/posts?select=id,image&story=is.false&owner=eq.' + q + '&order=id.desc&limit=9')]).then(function (r) {
    if (ticket !== vstate || view.peer) return;
    var p = r[0][0]; if (!p) { m.innerHTML = '<div class="center">Pengguna tidak ditemukan.</div>'; return; }
    people[id] = p; if (own) me = p;
    var fans = r[1].filter(function (x) { return x.followed === id; }), mine = r[1].filter(function (x) { return x.follower === id; });
    var following = fans.some(function (x) { return x.follower === me.id; });
    m.innerHTML = '<div class="center">' + face(p, 'big') + '<b>@' + esc(p.username) + '</b><div>' + esc(p.name) + (p.bio ? '<div class="muted">' + esc(p.bio) + '</div>' : '') + '</div>' +
      '<div class="stats"><span><b>' + r[2].length + '</b>Video</span><span><b id="fans">' + fans.length + '</b>Pengikut</span><span><b>' + mine.length + '</b>Mengikuti</span></div>' +
      (own ? '<button class="ghost" data-a="oavatar">Ganti foto profil</button>' : '<div class="acts"><button class="' + (following ? 'ghost' : 'btn') + '" data-a="ofollow" data-id="' + esc(id) + '" data-on="' + (following ? 1 : '') + '">' + (following ? 'Mengikuti' : 'Ikuti') + '</button><button class="ghost" data-a="opeer" data-id="' + esc(id) + '">Pesan</button><button class="ghost danger" data-a="oblock" data-id="' + esc(id) + '">Blokir</button></div>') + '</div>' +
      '<div class="grid">' + r[2].map(function (v) { return '<button data-a="oplay" data-id="' + esc(v.path) + '" aria-label="Putar video"><video muted playsinline preload="metadata" src="' + esc(vurl(v.path)) + '#t=0.1"></video></button>'; }).join('') + '</div>' +
      (r[3].length ? '<p class="pad"><b>Foto</b></p><div class="grid">' + r[3].map(function (x) { return '<button data-a="ophoto" data-id="' + x.id + '" aria-label="Lihat foto"><img alt="" src="' + safe(x.image) + '"></button>'; }).join('') + '</div>' : '') +
      (own ? '<div class="center"><button class="ghost" data-a="ohideseen">' + (S.hideSeen ? 'Tampilkan status online saya' : 'Sembunyikan status online saya') + '</button></div><form class="pad" data-f="oprofile"><label>Nama<input type="text" id="on" maxlength="30" value="' + esc(p.name) + '"></label><label>Bio<input type="text" id="ob" maxlength="100" value="' + esc(p.bio || '') + '"></label><p style="margin-top:10px"><button class="btn">Simpan profil</button></p></form><div class="center"><button class="ghost" data-a="ologout">Keluar</button><button class="ghost danger" data-a="odelete">Hapus akun</button></div>' : '');
  }).catch(function (e) { fail(e); if (ticket === vstate && !view.peer) m.innerHTML = '<div class="center">Gagal memuat profil.</div>'; });
}
function loadOnline() {
  var ticket = vstate = String(Math.random());
  api('/rest/v1/videos?select=id,path,caption,owner,profiles(username,name,avatar),video_likes(user_id),video_comments(id)&order=id.desc&limit=20').then(function (l) {
    if (ticket !== vstate || view.tab !== 'video' || view.peer || view.prof) return;
    if (watcher) { watcher.disconnect(); watcher = null; }
    vids = l;
    $('main').innerHTML = l.length ? '<div id="vids">' + l.map(function (v) {
      var mine = v.owner === me.id, liked = v.video_likes.some(function (x) { return x.user_id === me.id; });
      return '<section class="vid" data-v="' + v.id + '"><video loop playsinline preload="metadata" muted src="' + esc(vurl(v.path)) + '" data-a="otap" data-id="' + v.id + '"></video><div class="vbar"><i></i></div>' +
        '<div class="vinfo"><button class="who" data-a="oprof" data-id="' + esc(v.owner) + '">' + face(v.profiles) + '@' + esc(v.profiles.username) + '</button><p>' + esc(v.caption) + '</p></div><div class="rail">' +
        '<button class="' + (liked ? 'liked' : '') + '" data-a="olike" data-id="' + v.id + '" aria-label="Suka">' + icon('heart') + '<small>' + v.video_likes.length + '</small></button>' +
        '<button data-a="ocomments" data-id="' + v.id + '" aria-label="Komentar">' + icon('talk') + '<small>' + v.video_comments.length + '</small></button>' +
        '<button data-a="sound" aria-label="Suara">' + icon(muted ? 'off' : 'on') + '</button>' +
        (mine ? '<button data-a="odelvideo" data-id="' + v.id + '" aria-label="Hapus">' + icon('trash') + '</button>' : '<button data-a="opeer" data-id="' + esc(v.owner) + '" aria-label="Pesan">' + icon('send') + '</button><button data-a="omore" data-id="' + v.id + '" aria-label="Lainnya">' + icon('more') + '</button>') + '</div></section>';
    }).join('') + '</div>' : '<div class="center" style="padding-top:90px">Belum ada video. Jadilah yang pertama.</div>';
    watcher = new IntersectionObserver(function (es) { es.forEach(function (e) { var x = e.target; if (e.intersectionRatio > .6) { x.muted = muted; var p = x.play(); if (p) p.catch(function () {}); } else x.pause(); }); }, { threshold: [0, .6, 1] });
    document.querySelectorAll('#vids video').forEach(function (x) {
      x.muted = muted; watcher.observe(x);
      x.ontimeupdate = function () { if (x.duration) x.parentNode.querySelector('i').style.width = x.currentTime / x.duration * 100 + '%'; };
    });
  }).catch(function (e) { fail(e); if (ticket === vstate && view.tab === 'video' && !view.peer) $('main').innerHTML = '<div class="center" style="padding-top:90px">Gagal memuat video.</div>'; });
}
function video(id) { return vids.filter(function (x) { return String(x.id) === String(id); })[0]; }
function paintLike(v) {
  var b = document.querySelector('[data-a=olike][data-id="' + v.id + '"]'); if (!b) return;
  b.className = v.video_likes.some(function (x) { return x.user_id === me.id; }) ? 'liked' : '';
  b.querySelector('small').textContent = v.video_likes.length;
}
var liking = {};
function setLike(id, on) {
  var v = video(id); if (!v || liking[id]) return;
  var has = v.video_likes.some(function (x) { return x.user_id === me.id; }); if (has === on) return;
  var before = v.video_likes.slice();
  v.video_likes = on ? before.concat({ user_id: me.id }) : before.filter(function (x) { return x.user_id !== me.id; });
  paintLike(v); liking[id] = true;
  (on ? api('/rest/v1/video_likes', { method: 'POST', json: { video_id: v.id } }) : api('/rest/v1/video_likes?video_id=eq.' + v.id + '&user_id=eq.' + me.id, { method: 'DELETE' }))
    .catch(function (e) { if (e.status !== 409) { v.video_likes = before; paintLike(v); fail(e); } }).then(function () { delete liking[id]; });
}
function closeSheet() { var e = $('#sheet'); if (e) e.parentNode.removeChild(e); comments = null; }
function openSheet(html, cls) { closeSheet(); var e = document.createElement('div'); e.id = 'sheet'; e.className = cls || ''; e.innerHTML = html; document.body.appendChild(e); return e; }
var ckind = 'video';
function loadComments() {
  var id = comments, kind = ckind; if (!id) return;
  api('/rest/v1/' + kind + '_comments?select=id,user_id,body&' + kind + '_id=eq.' + id + '&order=id.desc&limit=100').then(function (l) {
    var need = []; l.forEach(function (c) { if (!people[c.user_id] && need.indexOf(c.user_id) < 0) need.push(c.user_id); });
    var p = need.length ? api('/rest/v1/profiles?select=' + FIELDS + '&id=in.(' + need.join(',') + ')').then(function (r) { r.forEach(function (x) { people[x.id] = x; }); }) : Promise.resolve();
    return p.then(function () {
      if (comments !== id || ckind !== kind) return;
      var item = kind === 'video' ? video(id) : post(id), owner = item && item.owner === me.id;
      $('#clist').innerHTML = l.reverse().map(function (c) {
        var u = people[c.user_id] || { name: '?', username: '?' };
        return '<div class="row">' + face(u) + '<span class="grow"><b>@' + esc(u.username) + '</b><div style="overflow-wrap:anywhere">' + esc(c.body) + '</div></span>' + (owner || c.user_id === me.id ? '<button class="danger" data-a="odelcomment" data-id="' + c.id + '">Hapus</button>' : '') + '</div>';
      }).join('') || '<div class="center muted">Belum ada komentar.</div>';
      if (item) { item[kind + '_comments'] = l; var n = document.querySelector('[data-a=' + (kind === 'video' ? 'ocomments' : 'opcomments') + '][data-id="' + id + '"] small'); if (n) n.textContent = l.length; }
    });
  }).catch(fail);
}
function commentSheet(kind, id) {
  openSheet('<div class="row"><b class="grow">Komentar</b><button data-a="oclose">Tutup</button></div><div id="clist"><div class="center muted">Memuat...</div></div><form class="form" data-f="ocomment"><input type="text" id="ct" maxlength="500" placeholder="Tulis komentar" aria-label="Komentar" autocomplete="off"><button class="btn">Kirim</button></form>');
  ckind = kind; comments = id; loadComments();
}
act.otap = function (id) {
  var x = document.querySelector('#vids video[data-id="' + id + '"]');
  if (tapTimer) {
    clearTimeout(tapTimer); tapTimer = 0; setLike(id, true);
    var b = document.createElement('div'); b.className = 'burst'; b.innerHTML = icon('heart'); x.parentNode.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 850); return;
  }
  tapTimer = setTimeout(function () { tapTimer = 0; if (x.paused) x.play(); else x.pause(); }, 280);
};
act.olike = function (id) { var v = video(id); if (v) setLike(id, !v.video_likes.some(function (x) { return x.user_id === me.id; })); };
act.sound = function () { muted = !muted; document.querySelectorAll('#vids video').forEach(function (v) { v.muted = muted; }); document.querySelectorAll('[data-a=sound]').forEach(function (b) { b.innerHTML = icon(muted ? 'off' : 'on'); }); };
act.ocomments = function (id) { commentSheet('video', id); };
act.oclose = closeSheet;
act.odelcomment = function (id) { if (confirm('Hapus komentar ini?')) api('/rest/v1/' + ckind + '_comments?id=eq.' + Number(id), { method: 'DELETE' }).then(loadComments).catch(fail); };
act.omore = function (id) {
  var v = video(id); if (!v) return;
  openSheet('<div class="center"><button class="ghost" data-a="oreport" data-id="' + v.id + '">Laporkan video</button><button class="ghost danger" data-a="oblock" data-id="' + esc(v.owner) + '">Blokir pengguna</button><button class="ghost" data-a="oclose">Batal</button></div>').style.height = 'auto';
};
act.oplay = function (path) { openSheet('<button class="pad" data-a="oclose">&#8592; Tutup</button><video controls autoplay loop playsinline src="' + esc(vurl(path)) + '"></video>', 'full'); };
act.oprof = function (id) { stopRec(false); closeSheet(); view.peer = null; view.prof = id; render(); $('main').scrollTop = 0; };
act.ofollow = function (id) {
  var b = document.querySelector('[data-a=ofollow]'), on = !!b.getAttribute('data-on'); if (b.disabled) return; b.disabled = true;
  (on ? api('/rest/v1/follows?follower=eq.' + me.id + '&followed=eq.' + encodeURIComponent(id), { method: 'DELETE' }) : api('/rest/v1/follows', { method: 'POST', json: { followed: id } }))
    .then(function () { if (view.prof === id && !view.peer) render(); }).catch(function (e) { b.disabled = false; fail(e); });
};
act.oavatar = function () {
  pick(function (img) {
    var i = new Image(); i.onload = function () {
      var c = document.createElement('canvas'), n = Math.min(i.width, i.height); c.width = c.height = 200;
      c.getContext('2d').drawImage(i, (i.width - n) / 2, (i.height - n) / 2, n, n, 0, 0, 200, 200);
      var data = c.toDataURL('image/jpeg', .75);
      api('/rest/v1/profiles?id=eq.' + me.id, { method: 'PATCH', json: { avatar: data } }).then(function () { me.avatar = data; render(); toast('Foto profil diganti'); }).catch(fail);
    }; i.src = img;
  });
};
act.oemoji = function (x) { send({ t: x }); };
send = function (msg) {
  if (!view.peer) return localSend(msg);
  var kind = msg.audio ? 'audio' : msg.img ? 'photo' : 'text', content = msg.audio || msg.img || msg.t;
  if (content.length > 900000) { toast('Pesan terlalu besar'); return false; }
  var data = { recipient: view.peer, kind: kind, body: content };
  if (view.reply) { data.reply_to = view.reply; view.reply = null; var bar = document.querySelector('[data-a=onoreply]'); if (bar) bar.parentNode.parentNode.removeChild(bar.parentNode); }
  api('/rest/v1/messages', { method: 'POST', prefer: 'return=representation', json: data })
    .then(function (r) { r.mine = true; add(r); poll(); })
    .catch(function (e) { fail(e); var i = $('#msg'); if (kind === 'text' && i && !i.value) i.value = content; });
  return true;
};
act.tab = function (id) { view.reply = null; stopRec(false); closeSheet(); view.peer = null; view.prof = null; localTab(id); };
act.back = function () { if (view.peer) { view.reply = null; stopRec(false); view.peer = null; render(); } else if (view.prof) { view.prof = null; render(); } else localBack(); };
window.goBack = function () { if ($('#sheet')) { closeSheet(); return true; } if ((view.peer || view.prof) && $('#story').hidden) { act.back(); return true; } return localGoBack(); };
act.oswitch = function () { signup = !signup; render(); };
act.ologout = function () { if (session) call('/auth/v1/logout?scope=local', { method: 'POST', token: session.token }).catch(function () {}); logout(); };
act.opeer = function (id) {
  function open() { closeSheet(); view.reply = null; view.peer = id; render(); poll(); markRead(); peerStatus(); }
  var known = people[id] || online.filter(function (p) { return p.id === id; })[0];
  if (known) { people[id] = known; open(); return; }
  api('/rest/v1/profiles?select=' + FIELDS + '&id=eq.' + encodeURIComponent(id)).then(function (l) { if (l.length) { people[id] = l[0]; open(); } }).catch(fail);
};
act.orefresh = function () { render(); };
act.newvideo = function () {
  var f = $('#file'); f.accept = 'video/*'; f.value = '';
  f.onchange = function () {
    var x = f.files[0]; if (!x) return;
    if (x.size > 50 * 1048576) { toast('Video lebih dari 50 MB'); return; }
    var ext = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/quicktime': 'mov' }[x.type];
    if (!ext) { toast('Format video tidak didukung. Pakai MP4.'); return; }
    modal('Keterangan video (semua pengguna bisa melihat)', function (t) {
      if (busy) { toast('Masih mengunggah video lain'); return; }
      busy = true; toast('Mengunggah...');
      var path = me.id + '/' + Date.now() + '.' + ext;
      api('/storage/v1/object/videos/' + path, { method: 'POST', type: x.type, body: x }).then(function () {
        return api('/rest/v1/videos', { method: 'POST', json: { path: path, caption: t } }).catch(function (e) {
          return api('/storage/v1/object/videos/' + path, { method: 'DELETE' }).then(function () { throw e; });
        });
      }).then(function () { toast('Video terunggah'); if (view.tab === 'video' && !view.peer) render(); }).catch(fail).then(function () { busy = false; });
    }, true);
  };
  f.click();
};
act.odelvideo = function (id) {
  var v = vids.filter(function (x) { return String(x.id) === id; })[0];
  if (!v || !confirm('Hapus video ini?')) return;
  api('/storage/v1/object/videos/' + v.path, { method: 'DELETE' }).then(function () { return api('/rest/v1/videos?id=eq.' + v.id, { method: 'DELETE' }); }).then(render).catch(fail);
};
act.oreport = function (id) {
  if (confirm('Laporkan video ini ke pengelola?')) api('/rest/v1/reports', { method: 'POST', json: { video_id: Number(id) } }).then(function () { closeSheet(); toast('Laporan terkirim'); }).catch(fail);
};
act.oblock = function (id) {
  if (!confirm('Blokir pengguna ini? Kalian tidak bisa saling kirim pesan atau melihat video.')) return;
  api('/rest/v1/blocks', { method: 'POST', json: { blocked: id } }).then(function () { toast('Diblokir'); stopRec(false); closeSheet(); view.peer = null; view.prof = null; render(); }).catch(fail);
};
act.odelete = function () {
  if (!confirm('Hapus akun beserta pesan dan videomu? Tidak bisa dibatalkan.')) return;
  api('/rest/v1/videos?select=path&owner=eq.' + me.id).then(function (l) {
    return Promise.all(l.map(function (v) { return api('/storage/v1/object/videos/' + v.path, { method: 'DELETE' }); }));
  }).then(function () { return api('/rest/v1/rpc/delete_me', { method: 'POST', json: {} }); }).then(function () { logout(); toast('Akun dihapus'); }).catch(fail);
};
function authenticate() {
  var e = $('#oe').value.trim(), p = $('#op').value, u = signup ? $('#ou').value.trim().toLowerCase().replace(/^@/, '') : '', creating = signup;
  if (creating && !/^[a-z0-9._]{3,20}$/.test(u)) { toast('Username 3-20 karakter: huruf, angka, titik, garis bawah'); return; }
  if (e.indexOf('@') < 1 || p.length < 8) { toast('Isi email dan kata sandi minimal 8 karakter'); return; }
  if (busy) return; busy = true;
  var step = !creating ? call('/auth/v1/token?grant_type=password', { method: 'POST', json: { email: e, password: p } })
    : call('/rest/v1/rpc/username_free', { method: 'POST', json: { u: u } }).then(function (free) {
      if (!free) throw new Error('Username sudah dipakai');
      return call('/auth/v1/signup', { method: 'POST', json: { email: e, password: p, data: { username: u } } });
    });
  step.then(function (s) {
    if (!s.access_token) { signup = false; render(); toast('Cek emailmu untuk konfirmasi, lalu masuk'); return; }
    clearData(); keepSession(s); view = { tab: 'chat', chat: null }; render(); start();
  }).catch(fail).then(function () { busy = false; });
}
document.addEventListener('submit', function (ev) {
  var k = ev.target.getAttribute('data-f');
  if (k === 'oauth') authenticate();
  else if (k === 'ocomment') {
    var box = $('#ct'), text = box.value.trim(), vid = comments; if (!text || !vid) return; box.value = '';
    var row = { body: text }; row[ckind + '_id'] = Number(vid);
    api('/rest/v1/' + ckind + '_comments', { method: 'POST', json: row }).then(loadComments).catch(function (e) { box.value = text; fail(e); });
  }
  else if (k === 'osend') { var i = $('#msg'), v = i.value.trim(); if (v && send({ t: v })) { i.value = ''; i.focus(); } }
  else if (k === 'oprofile') {
    var n = $('#on').value.trim(), bio = $('#ob').value.trim(); if (!n) { toast('Nama tidak boleh kosong'); return; }
    api('/rest/v1/profiles?id=eq.' + me.id, { method: 'PATCH', json: { name: n, bio: bio } }).then(function () { me.name = n; me.bio = bio; render(); toast('Disimpan'); }).catch(fail);
  }
});
setInterval(poll, 4000);
setInterval(function () { ticks++; if (ticks % 2 === 0) ping(); peerStatus(); }, 15000);
document.addEventListener('visibilitychange', function () { if (!document.hidden) { ping(); poll(); } });
view.peer = null; view.prof = null; render(); if (session && !problem) start();
})();
