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

var FIELDS = 'id,username,name,bio,avatar';
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
  '.grid video{width:100%;aspect-ratio:3/4;object-fit:cover;background:#000;pointer-events:none}.grid button{display:block}';
document.head.appendChild(css);
var comments = null, tapTimer = 0;
var session = null, me = null, people = {}, msgs = [], lastId = 0, online = [], gen = 0, polling = false, signup = false, busy = false, vstate = '';
try { session = JSON.parse(localStorage.getItem(SKEY)); } catch (e) {}
function keepSession(s) {
  session = s ? { token: s.access_token, refresh: s.refresh_token, uid: s.user.id, exp: Date.now() + s.expires_in * 1000 } : null;
  if (session) localStorage.setItem(SKEY, JSON.stringify(session)); else localStorage.removeItem(SKEY);
}
function clearData() { closeSheet(); view.prof = null; clearTimeout(tapTimer); gen++; me = null; people = {}; msgs = []; lastId = 0; online = []; polling = false; vstate = ''; view.peer = null; }
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
    me = r[0]; people[me.id] = me; render(); poll();
  }).catch(function (e) { if (g !== gen) return; if (/(bio|avatar).*does not exist/.test(e.message)) e = new Error('Server belum diperbarui. Jalankan schema-3.sql di Supabase.'); fail(e); setTimeout(function () { if (g === gen && !me) start(); }, 5000); });
}
function poll() {
  if (!me || polling || document.hidden) return;
  polling = true; var g = gen, first = !lastId;
  api('/rest/v1/messages?select=*&order=id.' + (first ? 'desc&limit=100' : 'asc&limit=50&id=gt.' + lastId)).then(function (r) {
    if (first) r.reverse();
    var need = [];
    r.forEach(function (m) { var o = other(m); if (!people[o] && need.indexOf(o) < 0) need.push(o); });
    var p = need.length ? api('/rest/v1/profiles?select=' + FIELDS + '&id=in.(' + need.join(',') + ')').then(function (l) { l.forEach(function (x) { people[x.id] = x; }); }) : Promise.resolve();
    return p.then(function () { add(r); });
  }).catch(fail).then(function () { if (g === gen) polling = false; });
}
function other(m) { return m.sender === me.id ? m.recipient : m.sender; }
function add(r) {
  if (!r.mine) r.forEach(function (m) { if (m.id > lastId) lastId = m.id; });
  var fresh = r.filter(function (m) { return !msgs.some(function (x) { return x.id === m.id; }); });
  if (!fresh.length) return;
  msgs = msgs.concat(fresh).sort(function (a, b) { return a.id - b.id; });
  if (view.peer) { var box = $('#msgs'); if (box) { box.innerHTML = thread(); $('main').scrollTop = $('main').scrollHeight; } }
  else if (view.tab === 'chat' && !view.prof) render();
}
function body(m) {
  if (m.kind === 'photo') return /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(m.body) ? '<img alt="Foto" src="' + m.body + '">' : '[Foto tidak didukung]';
  if (m.kind === 'audio') return /^data:audio\/mp4;base64,[A-Za-z0-9+\/=]+$/.test(m.body) ? '<audio controls src="' + m.body + '"></audio>' : '[Suara tidak didukung]';
  return esc(m.body);
}
function face(p, cls) { return av(p.name, /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(p.avatar || '') ? p.avatar : '', cls); }
function big(m) { return m.kind === 'text' && m.body.length <= 8 && !/[A-Za-z0-9<>&.,?!]/.test(m.body) && /[^\u0000-\u2000]/.test(m.body); }
function thread() {
  return msgs.filter(function (m) { return other(m) === view.peer; }).map(function (m) {
    return '<div class="m ' + (m.sender === me.id ? 'me' : '') + (big(m) ? ' big' : '') + '">' + body(m) + '<small>' + time(Date.parse(m.created_at)) + '</small></div>';
  }).join('') || '<p class="muted">Belum ada pesan.</p>';
}
function personRow(p, sub, action) {
  return '<button class="row" data-a="' + (action || 'opeer') + '" data-id="' + esc(p.id) + '">' + face(p) + '<span class="grow"><b>@' + esc(p.username) + '</b><div class="muted cut">' + esc(sub) + '</div></span></button>';
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
    h.innerHTML = '<button data-a="back" aria-label="Kembali">&#8592;</button>' + face(p) + '<h1 data-a="oprof" data-id="' + esc(p.id) + '">@' + esc(p.username) + '</h1><button class="danger" data-a="oblock" data-id="' + esc(p.id) + '">Blokir</button>';
    var old = $('#msg'), val = old ? old.value : '';
    m.innerHTML = '<div id="msgs">' + thread() + '</div>';
    f.innerHTML = (rec ? '' : '<div class="emo">' + ['\uD83D\uDE02', '\u2764\uFE0F', '\uD83D\uDC4D', '\uD83D\uDD25', '\uD83D\uDE2D', '\uD83D\uDE4F'].map(function (x) { return '<button data-a="oemoji" data-id="' + x + '" aria-label="Kirim ' + x + '">' + x + '</button>'; }).join('') + '</div>') + (rec ? '<div class="form"><button class="ghost" data-a="reccancel">Batal</button><span class="rec">&#9679; Merekam <span id="sec">' + Math.round((Date.now() - rec.at) / 1000) + '</span> dtk</span><button class="btn" data-a="recsend">Kirim</button></div>'
      : '<form class="form" data-f="osend"><button type="button" class="ico" data-a="sendphoto">Foto</button><button type="button" class="ico" data-a="record" aria-label="Rekam pesan suara">VN</button><input type="text" id="msg" maxlength="4000" placeholder="Tulis pesan" aria-label="Pesan" autocomplete="off"><button class="btn">Kirim</button></form>');
    if ($('#msg')) $('#msg').value = val;
    m.scrollTop = m.scrollHeight; return;
  }
  if (view.tab === 'feed') { localRender(); m.insertAdjacentHTML('afterbegin', '<p class="note">Foto dan cerita di tab ini masih tersimpan di HP saja.</p>'); return; }
  f.innerHTML = ''; nv.hidden = false; nv.className = view.tab === 'video' ? 'onvideo' : ''; m.className = view.tab === 'video' ? '' : 'pad-nav';
  moveLens(index(view.tab));
  if (view.prof) { m.className = 'pad-nav'; profilePage(view.prof); return; }
  if (view.tab === 'chat') {
    h.innerHTML = '<h1>Sapaloka</h1><button class="btn" data-a="tab" data-id="search">+ Obrolan</button>';
    var last = {}; msgs.forEach(function (x) { last[other(x)] = x; });
    m.innerHTML = Object.keys(last).sort(function (a, b) { return last[b].id - last[a].id; }).map(function (id) {
      var x = last[id]; return people[id] ? personRow(people[id], x.kind === 'text' ? x.body : x.kind === 'photo' ? '[Foto]' : '[Pesan suara]') : '';
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
  } else {
    profilePage(me.id);
  }
};
function profilePage(id) {
  var h = $('header'), m = $('main'), own = id === me.id, ticket = vstate = String(Math.random());
  h.innerHTML = (view.prof ? '<button data-a="back" aria-label="Kembali">&#8592;</button>' : '') + '<h1>Profil</h1>' + (own && !view.prof ? '<button class="ghost" data-a="dark">' + (S.dark ? 'Terang' : 'Gelap') + '</button>' : '');
  m.innerHTML = '<div class="center muted">Memuat...</div>';
  var q = encodeURIComponent(id);
  Promise.all([api('/rest/v1/profiles?select=' + FIELDS + '&id=eq.' + q),
    api('/rest/v1/follows?select=follower,followed&or=(follower.eq.' + q + ',followed.eq.' + q + ')'),
    api('/rest/v1/videos?select=id,path,caption,owner&owner=eq.' + q + '&order=id.desc&limit=30')]).then(function (r) {
    if (ticket !== vstate || view.peer) return;
    var p = r[0][0]; if (!p) { m.innerHTML = '<div class="center">Pengguna tidak ditemukan.</div>'; return; }
    people[id] = p; if (own) me = p;
    var fans = r[1].filter(function (x) { return x.followed === id; }), mine = r[1].filter(function (x) { return x.follower === id; });
    var following = fans.some(function (x) { return x.follower === me.id; });
    m.innerHTML = '<div class="center">' + face(p, 'big') + '<b>@' + esc(p.username) + '</b><div>' + esc(p.name) + (p.bio ? '<div class="muted">' + esc(p.bio) + '</div>' : '') + '</div>' +
      '<div class="stats"><span><b>' + r[2].length + '</b>Video</span><span><b id="fans">' + fans.length + '</b>Pengikut</span><span><b>' + mine.length + '</b>Mengikuti</span></div>' +
      (own ? '<button class="ghost" data-a="oavatar">Ganti foto profil</button>' : '<div class="acts"><button class="' + (following ? 'ghost' : 'btn') + '" data-a="ofollow" data-id="' + esc(id) + '" data-on="' + (following ? 1 : '') + '">' + (following ? 'Mengikuti' : 'Ikuti') + '</button><button class="ghost" data-a="opeer" data-id="' + esc(id) + '">Pesan</button><button class="ghost danger" data-a="oblock" data-id="' + esc(id) + '">Blokir</button></div>') + '</div>' +
      '<div class="grid">' + r[2].map(function (v) { return '<button data-a="oplay" data-id="' + esc(v.path) + '" aria-label="Putar video"><video muted playsinline preload="metadata" src="' + esc(vurl(v.path)) + '#t=0.1"></video></button>'; }).join('') + '</div>' +
      (own ? '<form class="pad" data-f="oprofile"><label>Nama<input type="text" id="on" maxlength="30" value="' + esc(p.name) + '"></label><label>Bio<input type="text" id="ob" maxlength="100" value="' + esc(p.bio || '') + '"></label><p style="margin-top:10px"><button class="btn">Simpan profil</button></p></form><div class="center"><button class="ghost" data-a="ologout">Keluar</button><button class="ghost danger" data-a="odelete">Hapus akun</button></div>' : '');
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
function loadComments() {
  var id = comments; if (!id) return;
  api('/rest/v1/video_comments?select=id,user_id,body&video_id=eq.' + id + '&order=id.desc&limit=100').then(function (l) {
    var need = []; l.forEach(function (c) { if (!people[c.user_id] && need.indexOf(c.user_id) < 0) need.push(c.user_id); });
    var p = need.length ? api('/rest/v1/profiles?select=' + FIELDS + '&id=in.(' + need.join(',') + ')').then(function (r) { r.forEach(function (x) { people[x.id] = x; }); }) : Promise.resolve();
    return p.then(function () {
      if (comments !== id) return;
      var v = video(id), owner = v && v.owner === me.id;
      $('#clist').innerHTML = l.reverse().map(function (c) {
        var u = people[c.user_id] || { name: '?', username: '?' };
        return '<div class="row">' + face(u) + '<span class="grow"><b>@' + esc(u.username) + '</b><div style="overflow-wrap:anywhere">' + esc(c.body) + '</div></span>' + (owner || c.user_id === me.id ? '<button class="danger" data-a="odelcomment" data-id="' + c.id + '">Hapus</button>' : '') + '</div>';
      }).join('') || '<div class="center muted">Belum ada komentar.</div>';
      if (v) { v.video_comments = l; var n = document.querySelector('[data-a=ocomments][data-id="' + id + '"] small'); if (n) n.textContent = l.length; }
    });
  }).catch(fail);
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
act.ocomments = function (id) {
  openSheet('<div class="row"><b class="grow">Komentar</b><button data-a="oclose">Tutup</button></div><div id="clist"><div class="center muted">Memuat...</div></div><form class="form" data-f="ocomment"><input type="text" id="ct" maxlength="500" placeholder="Tulis komentar" aria-label="Komentar" autocomplete="off"><button class="btn">Kirim</button></form>');
  comments = id; loadComments();
};
act.oclose = closeSheet;
act.odelcomment = function (id) { if (confirm('Hapus komentar ini?')) api('/rest/v1/video_comments?id=eq.' + Number(id), { method: 'DELETE' }).then(loadComments).catch(fail); };
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
  api('/rest/v1/messages', { method: 'POST', prefer: 'return=representation', json: { recipient: view.peer, kind: kind, body: content } })
    .then(function (r) { r.mine = true; add(r); poll(); })
    .catch(function (e) { fail(e); var i = $('#msg'); if (kind === 'text' && i && !i.value) i.value = content; });
  return true;
};
act.tab = function (id) { stopRec(false); closeSheet(); view.peer = null; view.prof = null; localTab(id); };
act.back = function () { if (view.peer) { stopRec(false); view.peer = null; render(); } else if (view.prof) { view.prof = null; render(); } else localBack(); };
window.goBack = function () { if ($('#sheet')) { closeSheet(); return true; } if ((view.peer || view.prof) && $('#story').hidden) { act.back(); return true; } return localGoBack(); };
act.oswitch = function () { signup = !signup; render(); };
act.ologout = function () { if (session) call('/auth/v1/logout?scope=local', { method: 'POST', token: session.token }).catch(function () {}); logout(); };
act.opeer = function (id) {
  function open() { closeSheet(); view.peer = id; render(); poll(); }
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
    api('/rest/v1/video_comments', { method: 'POST', json: { video_id: Number(vid), body: text } }).then(loadComments).catch(function (e) { box.value = text; fail(e); });
  }
  else if (k === 'osend') { var i = $('#msg'), v = i.value.trim(); if (v && send({ t: v })) { i.value = ''; i.focus(); } }
  else if (k === 'oprofile') {
    var n = $('#on').value.trim(), bio = $('#ob').value.trim(); if (!n) { toast('Nama tidak boleh kosong'); return; }
    api('/rest/v1/profiles?id=eq.' + me.id, { method: 'PATCH', json: { name: n, bio: bio } }).then(function () { me.name = n; me.bio = bio; render(); toast('Disimpan'); }).catch(fail);
  }
});
setInterval(poll, 4000);
view.peer = null; view.prof = null; render(); if (session && !problem) start();
})();
