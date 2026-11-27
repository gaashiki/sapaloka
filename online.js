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

var session = null, me = null, people = {}, msgs = [], lastId = 0, online = [], gen = 0, polling = false, signup = false, busy = false, vstate = '';
try { session = JSON.parse(localStorage.getItem(SKEY)); } catch (e) {}
function keepSession(s) {
  session = s ? { token: s.access_token, refresh: s.refresh_token, uid: s.user.id, exp: Date.now() + s.expires_in * 1000 } : null;
  if (session) localStorage.setItem(SKEY, JSON.stringify(session)); else localStorage.removeItem(SKEY);
}
function clearData() { gen++; me = null; people = {}; msgs = []; lastId = 0; online = []; polling = false; vstate = ''; view.peer = null; }
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
  api('/rest/v1/profiles?select=id,username,name&id=eq.' + session.uid).then(function (r) {
    if (!r.length) { logout(); toast('Profil tidak ditemukan. Daftar ulang.'); return; }
    me = r[0]; people[me.id] = me; render(); poll();
  }).catch(function (e) { if (g !== gen) return; fail(e); setTimeout(function () { if (g === gen && !me) start(); }, 5000); });
}
function poll() {
  if (!me || polling || document.hidden) return;
  polling = true; var g = gen, first = !lastId;
  api('/rest/v1/messages?select=*&order=id.' + (first ? 'desc&limit=100' : 'asc&limit=50&id=gt.' + lastId)).then(function (r) {
    if (first) r.reverse();
    var need = [];
    r.forEach(function (m) { var o = other(m); if (!people[o] && need.indexOf(o) < 0) need.push(o); });
    var p = need.length ? api('/rest/v1/profiles?select=id,username,name&id=in.(' + need.join(',') + ')').then(function (l) { l.forEach(function (x) { people[x.id] = x; }); }) : Promise.resolve();
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
  else if (view.tab === 'chat') render();
}
function body(m) {
  if (m.kind === 'photo') return /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(m.body) ? '<img alt="Foto" src="' + m.body + '">' : '[Foto tidak didukung]';
  if (m.kind === 'audio') return /^data:audio\/mp4;base64,[A-Za-z0-9+\/=]+$/.test(m.body) ? '<audio controls src="' + m.body + '"></audio>' : '[Suara tidak didukung]';
  return esc(m.body);
}
function thread() {
  return msgs.filter(function (m) { return other(m) === view.peer; }).map(function (m) {
    return '<div class="m ' + (m.sender === me.id ? 'me' : '') + '">' + body(m) + '<small>' + time(Date.parse(m.created_at)) + '</small></div>';
  }).join('') || '<p class="muted">Belum ada pesan.</p>';
}
function personRow(p, sub) {
  return '<button class="row" data-a="opeer" data-id="' + esc(p.id) + '">' + av(p.name) + '<span class="grow"><b>@' + esc(p.username) + '</b><div class="muted cut">' + esc(sub) + '</div></span></button>';
}
function vurl(p) { return URL_ + '/storage/v1/object/public/videos/' + p.split('/').map(encodeURIComponent).join('/'); }

render = function () {
  var h = $('header'), m = $('main'), f = $('#foot'), nv = $('#nav');
  document.body.className = S.dark ? 'dark' : '';
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
    h.innerHTML = '<button data-a="back" aria-label="Kembali">&#8592;</button>' + av(p.name) + '<h1>@' + esc(p.username) + '</h1><button class="danger" data-a="oblock" data-id="' + esc(p.id) + '">Blokir</button>';
    var old = $('#msg'), val = old ? old.value : '';
    m.innerHTML = '<div id="msgs">' + thread() + '</div>';
    f.innerHTML = rec ? '<div class="form"><button class="ghost" data-a="reccancel">Batal</button><span class="rec">&#9679; Merekam <span id="sec">' + Math.round((Date.now() - rec.at) / 1000) + '</span> dtk</span><button class="btn" data-a="recsend">Kirim</button></div>'
      : '<form class="form" data-f="osend"><button type="button" class="ico" data-a="sendphoto">Foto</button><button type="button" class="ico" data-a="record" aria-label="Rekam pesan suara">VN</button><input type="text" id="msg" maxlength="4000" placeholder="Tulis pesan" aria-label="Pesan" autocomplete="off"><button class="btn">Kirim</button></form>';
    if ($('#msg')) $('#msg').value = val;
    m.scrollTop = m.scrollHeight; return;
  }
  if (view.tab === 'feed') { localRender(); m.insertAdjacentHTML('afterbegin', '<p class="note">Foto dan cerita di tab ini masih tersimpan di HP saja.</p>'); return; }
  f.innerHTML = ''; nv.hidden = false; nv.className = view.tab === 'video' ? 'onvideo' : ''; m.className = view.tab === 'video' ? '' : 'pad-nav';
  moveLens(index(view.tab));
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
        api('/rest/v1/profiles?select=id,username,name&limit=20&id=neq.' + me.id + '&username=ilike.' + encodeURIComponent(q) + '*').then(function (l) {
          var box = $('#res'); if (k !== n || !box) return;
          online = l; box.innerHTML = l.map(function (p) { return personRow(p, p.name); }).join('') || '<div class="center muted">Tidak ditemukan.</div>';
        }).catch(fail);
      }, 400);
    };
  } else if (view.tab === 'video') {
    h.innerHTML = '<h1>Video</h1><button class="ghost" data-a="orefresh">Muat ulang</button><button class="btn" data-a="newvideo">+ Video</button>';
    m.innerHTML = '<div class="center muted">Memuat...</div>'; loadOnline();
  } else {
    h.innerHTML = '<h1>Profil</h1><button class="ghost" data-a="dark">' + (S.dark ? 'Terang' : 'Gelap') + '</button>';
    m.innerHTML = '<div class="center">' + av(me.name, '', 'big') + '<b>@' + esc(me.username) + '</b></div><form class="pad" data-f="oprofile"><label>Nama<input type="text" id="on" maxlength="30" value="' + esc(me.name) + '"></label><p style="margin-top:10px"><button class="btn">Simpan nama</button></p></form><div class="center"><button class="ghost" data-a="ologout">Keluar</button><button class="ghost danger" data-a="odelete">Hapus akun</button></div>';
  }
};
function loadOnline() {
  var ticket = vstate = String(Math.random());
  api('/rest/v1/videos?select=id,path,caption,owner,profiles(username)&order=id.desc&limit=20').then(function (l) {
    if (ticket !== vstate || view.tab !== 'video' || view.peer) return;
    if (watcher) { watcher.disconnect(); watcher = null; }
    vids = l;
    $('main').innerHTML = l.length ? '<div id="vids">' + l.map(function (v) {
      var mine = v.owner === me.id;
      return '<section class="vid"><video loop playsinline preload="metadata" muted src="' + esc(vurl(v.path)) + '" data-a="playpause" data-id="' + v.id + '"></video><div class="vinfo"><b>@' + esc(v.profiles.username) + '</b><p>' + esc(v.caption) + '</p></div><div class="vacts"><button data-a="sound">' + (muted ? 'Suara mati' : 'Suara aktif') + '</button>' +
        (mine ? '<button data-a="odelvideo" data-id="' + v.id + '">Hapus</button>' : '<button data-a="opeer" data-id="' + v.owner + '">Pesan</button><button data-a="oreport" data-id="' + v.id + '">Laporkan</button><button data-a="oblock" data-id="' + v.owner + '">Blokir</button>') + '</div></section>';
    }).join('') + '</div>' : '<div class="center">Belum ada video. Jadilah yang pertama.</div>';
    watcher = new IntersectionObserver(function (es) { es.forEach(function (e) { var x = e.target; if (e.intersectionRatio > .6) { x.muted = muted; var p = x.play(); if (p) p.catch(function () {}); } else x.pause(); }); }, { threshold: [0, .6, 1] });
    document.querySelectorAll('video').forEach(function (x) { x.muted = muted; watcher.observe(x); });
  }).catch(function (e) { fail(e); if (ticket === vstate && view.tab === 'video' && !view.peer) $('main').innerHTML = '<div class="center">Gagal memuat video.</div>'; });
}
send = function (msg) {
  if (!view.peer) return localSend(msg);
  var kind = msg.audio ? 'audio' : msg.img ? 'photo' : 'text', content = msg.audio || msg.img || msg.t;
  if (content.length > 900000) { toast('Pesan terlalu besar'); return false; }
  api('/rest/v1/messages', { method: 'POST', prefer: 'return=representation', json: { recipient: view.peer, kind: kind, body: content } })
    .then(function (r) { r.mine = true; add(r); poll(); })
    .catch(function (e) { fail(e); var i = $('#msg'); if (kind === 'text' && i && !i.value) i.value = content; });
  return true;
};
act.tab = function (id) { stopRec(false); view.peer = null; localTab(id); };
act.back = function () { if (view.peer) { stopRec(false); view.peer = null; render(); } else localBack(); };
window.goBack = function () { if (view.peer && $('#story').hidden) { act.back(); return true; } return localGoBack(); };
act.oswitch = function () { signup = !signup; render(); };
act.ologout = function () { if (session) call('/auth/v1/logout?scope=local', { method: 'POST', token: session.token }).catch(function () {}); logout(); };
act.opeer = function (id) {
  function open() { view.peer = id; render(); poll(); }
  var known = people[id] || online.filter(function (p) { return p.id === id; })[0];
  if (known) { people[id] = known; open(); return; }
  api('/rest/v1/profiles?select=id,username,name&id=eq.' + encodeURIComponent(id)).then(function (l) { if (l.length) { people[id] = l[0]; open(); } }).catch(fail);
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
  if (confirm('Laporkan video ini ke pengelola?')) api('/rest/v1/reports', { method: 'POST', json: { video_id: Number(id) } }).then(function () { toast('Laporan terkirim'); }).catch(fail);
};
act.oblock = function (id) {
  if (!confirm('Blokir pengguna ini? Kalian tidak bisa saling kirim pesan atau melihat video.')) return;
  api('/rest/v1/blocks', { method: 'POST', json: { blocked: id } }).then(function () { toast('Diblokir'); stopRec(false); view.peer = null; render(); }).catch(fail);
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
  else if (k === 'osend') { var i = $('#msg'), v = i.value.trim(); if (v && send({ t: v })) { i.value = ''; i.focus(); } }
  else if (k === 'oprofile') {
    var n = $('#on').value.trim(); if (!n) { toast('Nama tidak boleh kosong'); return; }
    api('/rest/v1/profiles?id=eq.' + me.id, { method: 'PATCH', json: { name: n } }).then(function () { me.name = n; render(); toast('Disimpan'); }).catch(fail);
  }
});
setInterval(poll, 4000);
view.peer = null; render(); if (session && !problem) start();
})();
        
