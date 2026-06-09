import './style.css';


'use strict';

/* ═══════════════════════════════════════════════════════════
   FIREBASE CONFIG
═══════════════════════════════════════════════════════════ */
const _APP_CONFIG = {
  apiKey: "AIzaSyC3Bmm0hWmvqT2P1vA1LCCSFCUFFHzm670",
  authDomain: "gomdon-e8368.firebaseapp.com",
  projectId: "gomdon-e8368",
  storageBucket: "gomdon-e8368.firebasestorage.app",
  messagingSenderId: "566237922304",
  appId: "1:566237922304:web:724ce262655533e252c4e5",
  measurementId: "G-6BLW3CK7X3"
};
// localStorage override for future config changes
let FIREBASE_CONFIG = _APP_CONFIG;
try {
  const saved = localStorage.getItem('gd_fb_cfg');
  if (saved) FIREBASE_CONFIG = JSON.parse(saved);
} catch(e) {}

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
// No mock menus or milestones needed in direct integration

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let currentUser  = null;   // Firebase Auth user
let userProfile  = null;   // Firestore user document
let currentCircleId = null;
let myCircles    = [];
let circleOrders = [];     // Real-time orders from Firestore
let nearbyOrders = [];     // GPS-filtered orders
let userLocation = null;   // {lat, lng}
let unsubOrders  = null;   // Firestore unsubscribe

// UI state
let currentTab    = 'home';
let currentScreen = 'main';
let nearbyFilter  = 'all';
let historyFilter = 'all';
let theme         = 'dark';

// Alert settings
let alertEnabled     = true;
let alertRadius      = 100;
let alertTimeWindows = new Set(['lunch']);

// Firebase instances
let auth, db, googleProvider;

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const vnd       = n  => Math.round(n).toLocaleString('vi-VN') + ' đ';
const nowTime   = () => { const d=new Date(); return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0'); };
const themeIcon = () => theme === 'dark' ? '☀️' : '🌙';
const firstName = () => currentUser?.displayName?.split(' ').pop() || 'bạn';
const curCircle = () => myCircles.find(c => c.id === currentCircleId) || myCircles[0] || null;
const curOrder  = () => circleOrders.find(o => o.status === 'collecting') || null;
const statusVN = s => ({collecting:'Đang Mở',delivered:'Đã Đóng',cancelled:'Đã Hủy'}[s]||s);

function calcDistance(lat1,lng1,lat2,lng2) {
  if (!lat1||!lat2) return 9999;
  const R=6371000, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(2*R*Math.asin(Math.sqrt(a)));
}
const distLabel = m => m < 1000 ? m+'m' : (m/1000).toFixed(1)+'km';
const detectPlatform = url => (url||'').includes('shopee')||(url||'').includes('now.vn') ? 'shopeefood' : 'grab';
function genCode(len=6){ return Math.random().toString(36).toUpperCase().slice(2,2+len); }
function timeAgoVN(ts) {
  if (!ts) return 'Vừa mở';
  const t = ts.toDate ? ts.toDate() : new Date(ts);
  const m = Math.round((Date.now()-t.getTime())/60000);
  if (m < 1) return 'Vừa mở';
  if (m < 60) return m+'ph trước';
  return Math.round(m/60)+'h trước';
}

/* ═══════════════════════════════════════════════════════════
   TOAST & CONFETTI
═══════════════════════════════════════════════════════════ */
function toast(msg) {
  const scr = document.getElementById('screen');
  let stack = scr.querySelector('.toast-stack');
  if (!stack) { stack=document.createElement('div'); stack.className='toast-stack'; scr.appendChild(stack); }
  const t=document.createElement('div'); t.className='toast-item'; t.textContent=msg;
  stack.appendChild(t); setTimeout(()=>t.remove(), 3700);
}

function confetti() {
  const cols=['#ff9f1c','#00b14f','#fff','#ffef5e','#ff6b6b'];
  const cvs=document.createElement('canvas');
  cvs.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9999;width:100%;height:100%';
  document.body.appendChild(cvs);
  const ctx=cvs.getContext('2d'); cvs.width=window.innerWidth; cvs.height=window.innerHeight;
  const ps=Array.from({length:80},()=>({x:Math.random()*cvs.width,y:-20,vx:(Math.random()-.5)*5,vy:Math.random()*4+2,w:Math.random()*9+3,h:Math.random()*5+2,col:cols[Math.floor(Math.random()*cols.length)],rot:Math.random()*360,spin:(Math.random()-.5)*7,alpha:1}));
  let f=0;
  (function draw(){
    ctx.clearRect(0,0,cvs.width,cvs.height);
    ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.1;p.rot+=p.spin;if(f>55)p.alpha=Math.max(0,p.alpha-.018);
      ctx.save();ctx.globalAlpha=p.alpha;ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.fillStyle=p.col;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();});
    if(++f<100)requestAnimationFrame(draw); else cvs.remove();
  })();
}

/* ═══════════════════════════════════════════════════════════
   GEOLOCATION
═══════════════════════════════════════════════════════════ */
function getUserLocation() {
  return new Promise((resolve,reject) => {
    if (!navigator.geolocation) { reject('no-geo'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { userLocation={lat:pos.coords.latitude,lng:pos.coords.longitude}; resolve(userLocation); },
      err => reject(err),
      {timeout:8000,enableHighAccuracy:true}
    );
  });
}

/* ═══════════════════════════════════════════════════════════
   FIREBASE INIT
═══════════════════════════════════════════════════════════ */
function initFirebase() {
  const app = firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  db   = firebase.firestore();
  googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.addScope('profile');
  googleProvider.addScope('email');

  auth.onAuthStateChanged(async user => {
    if (user) {
      currentUser = user;
      renderLoading();
      try {
        await loadOrCreateProfile(user);
        if (myCircles.length === 0) {
          renderOnboarding();
        } else {
          subscribeToOrders();
          renderApp();
          // Handle pending invite from URL
          const pending = sessionStorage.getItem('pending_invite');
          if (pending) {
            sessionStorage.removeItem('pending_invite');
            setTimeout(() => handleInviteCode(pending), 600);
          }
        }
      } catch(e) {
        toast('❌ Lỗi tải dữ liệu: ' + e.message);
        renderAuth();
      }
    } else {
      currentUser  = null;
      userProfile  = null;
      myCircles    = [];
      circleOrders = [];
      cleanupSubs();
      renderAuth();
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   DATA LAYER
═══════════════════════════════════════════════════════════ */
async function loadOrCreateProfile(user) {
  const ref  = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (snap.exists) {
    userProfile = {id:snap.id, ...snap.data()};
    const ids   = userProfile.circleIds || [];
    myCircles   = ids.length ? await loadCircles(ids) : [];
    currentCircleId = userProfile.lastCircleId || myCircles[0]?.id || null;
  } else {
    const data = {
      name:user.displayName, email:user.email, avatar:user.photoURL,
      provider:user.providerData[0]?.providerId||'google',
      circleIds:[], lastCircleId:null,
      stats:{ordersJoined:0,savedTotal:0},
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(data);
    userProfile = {id:user.uid, ...data};
    myCircles   = [];
  }
}

async function loadCircles(ids) {
  if (!ids||!ids.length) return [];
  const snaps = await Promise.all(ids.map(id=>db.collection('circles').doc(id).get()));
  return snaps.filter(s=>s.exists).map(s=>({id:s.id,...s.data()}));
}

async function createCircle(name,location) {
  const inviteCode = genCode();
  const ref = await db.collection('circles').add({
    name, location, memberUids:[currentUser.uid],
    createdBy:currentUser.uid, inviteCode,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
  });
  const cid = ref.id;
  await db.collection('users').doc(currentUser.uid).update({
    circleIds:firebase.firestore.FieldValue.arrayUnion(cid),
    lastCircleId:cid,
  });
  const circle = {id:cid,name,location,memberUids:[currentUser.uid],inviteCode};
  myCircles = [...myCircles, circle];
  currentCircleId = cid;
  return circle;
}

async function joinCircleByCode(code) {
  const snap = await db.collection('circles').where('inviteCode','==',code.trim().toUpperCase()).get();
  if (snap.empty) throw new Error('Không tìm thấy nhóm với mã này');
  const doc = snap.docs[0];
  const cid = doc.id;
  if (doc.data().memberUids?.includes(currentUser.uid)) {
    // Already a member – just switch to it
    currentCircleId = cid;
    await db.collection('users').doc(currentUser.uid).update({lastCircleId:cid});
    const existing = myCircles.find(c=>c.id===cid);
    if (!existing) myCircles = [...myCircles,{id:cid,...doc.data()}];
    return myCircles.find(c=>c.id===cid);
  }
  await db.collection('circles').doc(cid).update({memberUids:firebase.firestore.FieldValue.arrayUnion(currentUser.uid)});
  await db.collection('users').doc(currentUser.uid).update({
    circleIds:firebase.firestore.FieldValue.arrayUnion(cid), lastCircleId:cid,
  });
  const circle = {id:cid,...doc.data(),memberUids:[...(doc.data().memberUids||[]),currentUser.uid]};
  myCircles = [...myCircles.filter(c=>c.id!==cid), circle];
  currentCircleId = cid;
  return circle;
}

async function joinCircleDirect(circleId) {
  const circleRef = db.collection('circles').doc(circleId);
  const doc = await circleRef.get();
  if (!doc.exists) throw new Error('Nhóm không tồn tại');
  
  await circleRef.update({
    memberUids: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
  });
  
  await db.collection('users').doc(currentUser.uid).update({
    circleIds: firebase.firestore.FieldValue.arrayUnion(circleId),
    lastCircleId: circleId,
  });
  
  const circleData = { id: circleId, ...doc.data() };
  if (!circleData.memberUids) circleData.memberUids = [];
  if (!circleData.memberUids.includes(currentUser.uid)) {
    circleData.memberUids.push(currentUser.uid);
  }
  
  if (!myCircles.some(c => c.id === circleId)) {
    myCircles = [...myCircles, circleData];
  }
  currentCircleId = circleId;
}

async function handleInviteCode(code) {
  try {
    const circle = await joinCircleByCode(code);
    subscribeToOrders();
    renderApp();
    toast(`✅ Đã tham gia nhóm: ${circle.name}!`);
  } catch(e) { toast('❌ '+e.message); }
}

async function createOrder(link, platform, lat, lng, circleId) {
  const targetCircleId = circleId || currentCircleId;
  const circle = myCircles.find(c => c.id === targetCircleId) || curCircle();
  const restaurant = platform === 'shopeefood' ? 'ShopeeFood' : 'GrabFood';
  const emoji = platform === 'shopeefood' ? '🧋' : '🍜';
  const data   = {
    circleId:targetCircleId, circleName:circle?.name||'',
    hostUid:currentUser.uid, hostName:currentUser.displayName, hostAvatar:currentUser.photoURL,
    restaurant, emoji, platform, link,
    status:'collecting',
    participants: [
      {
        uid: currentUser.uid,
        name: currentUser.displayName,
        avatar: currentUser.photoURL,
        joinedAt: new Date()
      }
    ],
    messages: [],
    lat:lat||null, lng:lng||null,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt:new Date(Date.now()+45*60*1000),
  };
  const ref = await db.collection('orders').add(data);
  return {id:ref.id,...data};
}

async function joinOrderDirect(orderId) {
  const ref  = db.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Đơn không tồn tại');
  const order  = snap.data();
  const isAlreadyJoined = (order.participants || []).some(p => p.uid === currentUser.uid);
  if (isAlreadyJoined) return;
  const participant = {
    uid:currentUser.uid,
    name:currentUser.displayName,
    avatar:currentUser.photoURL,
    joinedAt:new Date()
  };
  await ref.update({
    participants: firebase.firestore.FieldValue.arrayUnion(participant)
  });
  await db.collection('users').doc(currentUser.uid).update({
    'stats.ordersJoined':firebase.firestore.FieldValue.increment(1),
    'stats.savedTotal':firebase.firestore.FieldValue.increment(20000),
  });
  userProfile = {...userProfile, stats:{ordersJoined:(userProfile?.stats?.ordersJoined||0)+1,savedTotal:(userProfile?.stats?.savedTotal||0)+20000}};
}

async function leaveOrderDirect(orderId) {
  const ref  = db.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Đơn không tồn tại');
  const order  = snap.data();
  const isJoined = (order.participants || []).some(p => p.uid === currentUser.uid);
  if (!isJoined) return;
  
  const updatedParticipants = (order.participants || []).filter(p => p.uid !== currentUser.uid);
  await ref.update({participants: updatedParticipants});
  
  await db.collection('users').doc(currentUser.uid).update({
    'stats.ordersJoined': firebase.firestore.FieldValue.increment(-1),
    'stats.savedTotal': firebase.firestore.FieldValue.increment(-20000),
  });
  
  userProfile = {
    ...userProfile, 
    stats: {
      ordersJoined: Math.max(0, (userProfile?.stats?.ordersJoined||0) - 1),
      savedTotal: Math.max(0, (userProfile?.stats?.savedTotal||0) - 20000)
    }
  };
}

async function sendOrderMessage(orderId, text) {
  if (!text.trim()) return;
  const ref = db.collection('orders').doc(orderId);
  const msg = {
    uid: currentUser.uid,
    name: currentUser.displayName,
    avatar: currentUser.photoURL,
    text: text.trim(),
    createdAt: new Date().toISOString()
  };
  await ref.update({
    messages: firebase.firestore.FieldValue.arrayUnion(msg)
  });
}

async function archiveOrder(orderId) {
  await db.collection('orders').doc(orderId).update({status:'delivered'});
}

async function cancelOrder(orderId) {
  await db.collection('orders').doc(orderId).update({status:'cancelled'});
}

async function loadNearbyOrders() {
  // Try GPS but don't block if it fails
  if (!userLocation) {
    try { await getUserLocation(); } catch(e) { userLocation = null; }
  }
  // No orderBy — avoids composite index requirement; sort client-side
  const snap = await db.collection('orders').where('status','==','collecting').limit(50).get();
  nearbyOrders = snap.docs
    .map(doc => {
      const d = doc.data();
      const dist = calcDistance(userLocation?.lat, userLocation?.lng, d.lat, d.lng);
      return {id:doc.id, ...d, dist, distLabel:distLabel(dist), distClass:dist<=50?'close':'mid'};
    })
    .filter(o => o.circleId !== currentCircleId)
    // If we have location, filter by radius; otherwise show everything
    .filter(o => !userLocation || o.dist <= alertRadius)
    // Sort by distance if we have location, otherwise by newest (createdAt)
    .sort((a,b) => userLocation ? a.dist-b.dist : 0);
  return nearbyOrders;
}

async function loadOrdersHistory() {
  const promises = [];
  promises.push(db.collection('orders').where('hostUid', '==', currentUser.uid).get());
  if (userProfile?.circleIds && userProfile.circleIds.length > 0) {
    userProfile.circleIds.forEach(cid => {
      promises.push(db.collection('orders').where('circleId', '==', cid).get());
    });
  }
  const snaps = await Promise.all(promises);
  const orderMap = new Map();
  snaps.forEach(snap => {
    snap.docs.forEach(doc => {
      orderMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
  });
  const list = Array.from(orderMap.values());
  list.sort((a, b) => {
    const tA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
    const tB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
    return tB - tA;
  });
  return list;
}


/* ═══════════════════════════════════════════════════════════
   REAL-TIME SUBSCRIPTIONS
═══════════════════════════════════════════════════════════ */
function subscribeToOrders() {
  cleanupSubs();
  const circleIds = myCircles.map(c => c.id);
  if (circleIds.length === 0) {
    circleOrders = [];
    if (currentScreen === 'main' && currentTab === 'home') {
      const body = document.getElementById('screenBody');
      if (body) renderHomeTab(body);
    }
    return;
  }
  unsubOrders = db.collection('orders')
    .where('circleId', 'in', circleIds)
    .where('status', '==', 'collecting')
    .onSnapshot(snap => {
      circleOrders = snap.docs.map(doc=>({id:doc.id,...doc.data()}));
      circleOrders.sort((a,b) => {
        const tA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date();
        const tB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date();
        return tB - tA;
      });
      if (currentScreen === 'main' && currentTab === 'home') {
        const body = document.getElementById('screenBody');
        if (body) renderHomeTab(body);
      }
    }, err => console.warn('Orders sub:', err.message));
}

function cleanupSubs() {
  if (unsubOrders) { unsubOrders(); unsubOrders=null; }
}

/* ═══════════════════════════════════════════════════════════
   AUTH FUNCTIONS
═══════════════════════════════════════════════════════════ */
async function signInGoogle() {
  const btn = document.getElementById('btnGoogle');
  const txt = btn ? (btn.querySelector('.ab-text') || btn.querySelector('span')) : null;
  if (btn) btn.disabled = true;
  if (txt) txt.textContent = 'Đang mở Google…';
  try {
    await auth.signInWithPopup(googleProvider);
  } catch(err) {
    if (btn) btn.disabled = false;
    if (txt) txt.textContent = 'Đăng nhập với Google';
    if (err.code === 'auth/popup-blocked') toast('⚠️ Popup bị chặn. Hãy cho phép popup trong trình duyệt rồi thử lại.');
    else if (err.code !== 'auth/popup-closed-by-user') toast('❌ '+err.message);
  }
}

async function signOutUser() {
  if (!confirm('Đăng xuất khỏi Gom Đơn?')) return;
  cleanupSubs();
  await auth.signOut();
}

/* ═══════════════════════════════════════════════════════════
   RENDER: SETUP SCREEN
═══════════════════════════════════════════════════════════ */
function renderSetupScreen() {
  const scr = document.getElementById('screen');
  scr.innerHTML = `
  <div class="setup-screen">
    <div class="setup-hero">
      <div class="setup-fire">🔥</div>
      <div class="setup-title">Kết Nối Firebase</div>
      <div class="setup-sub">Gom Đơn cần Firebase để đăng nhập thực và lưu dữ liệu. Miễn phí hoàn toàn.</div>
    </div>
    <div class="setup-body">
      <div class="setup-steps">
        <div class="ss-step"><span class="ss-num">1</span><div><b>Tạo Firebase Project miễn phí</b><a class="ss-link" href="https://console.firebase.google.com" target="_blank">console.firebase.google.com ↗</a></div></div>
        <div class="ss-step"><span class="ss-num">2</span><div><b>Authentication → Sign-in method → Google</b>Bật Google Sign-In, lưu lại</div></div>
        <div class="ss-step"><span class="ss-num">3</span><div><b>Firestore Database → Create database</b>Chọn "Start in test mode" → Next → Done</div></div>
        <div class="ss-step"><span class="ss-num">4</span><div><b>Project Settings → Your apps → Web app (⊕)</b>Sao chép đoạn <code>firebaseConfig = { … }</code></div></div>
      </div>
      <div class="ss-divider">Dán config JSON của bạn vào đây</div>
      <textarea id="configPaste" class="ss-textarea" placeholder='{"apiKey":"AIza…","authDomain":"your-app.firebaseapp.com","projectId":"your-app","storageBucket":"your-app.appspot.com","messagingSenderId":"12345","appId":"1:12345:web:abc"}'></textarea>
      <button class="ss-btn" id="saveConfigBtn">🚀 Kết Nối &amp; Bắt Đầu</button>
      <div class="ss-error" id="ssError" style="display:none"></div>
      <div style="font-size:9px;color:var(--t3);text-align:center;line-height:1.5">Config được lưu cục bộ trong trình duyệt của bạn.<br>Cần HTTPS để Google Sign-In hoạt động – hãy deploy lên Netlify.</div>
    </div>
  </div>`;

  document.getElementById('saveConfigBtn').onclick = () => {
    const err = document.getElementById('ssError');
    err.style.display = 'none';
    try {
      let raw = document.getElementById('configPaste').value.trim();
      // Allow JS object literal (strip assignment if present)
      raw = raw.replace(/^const\s+firebaseConfig\s*=\s*/, '').replace(/;$/, '').trim();
      const cfg = JSON.parse(raw);
      if (!cfg.apiKey||!cfg.projectId) throw new Error('Thiếu apiKey hoặc projectId');
      localStorage.setItem('gd_fb_cfg', JSON.stringify(cfg));
      location.reload();
    } catch(e) {
      err.textContent = '❌ '+e.message+' – Hãy dán đúng định dạng JSON';
      err.style.display = 'block';
    }
  };
}

/* ═══════════════════════════════════════════════════════════
   RENDER: LOADING
═══════════════════════════════════════════════════════════ */
function renderLoading() {
  document.getElementById('screen').innerHTML = `
  <div class="loading-screen">
    <img src="/logo.png" alt="Gom Đơn" style="height: 64px; width: auto; object-fit: contain; animation: logoPulse 1.5s ease-in-out infinite;">
    <div style="font-size:13px;color:var(--t2);font-weight:600">Đang tải dữ liệu…</div>
    <div class="loading-dots"><span></span><span></span><span></span></div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   RENDER: AUTH SCREEN
═══════════════════════════════════════════════════════════ */
function renderAuth() {
  const scr = document.getElementById('screen');
  scr.classList.remove('is-app');
  scr.innerHTML = `
  <div class="landing-container">
    <div class="landing-header">
      <div class="landing-logo"><img src="/logo.png" alt="Gom Đơn Logo" style="height: 38px; width: auto; object-fit: contain;"> Gom Đơn</div>
      <button class="auth-theme-btn" id="authThemeBtn">${themeIcon()}</button>
    </div>
    <div class="landing-hero">
      <h1 class="landing-title">Đặt cùng nhau,<br>Tiết kiệm cùng nhau</h1>
      <p class="landing-subtitle">Ứng dụng giúp bạn tìm và tham gia các đơn hàng ăn uống xung quanh để chia sẻ phí vận chuyển, tận dụng tối đa các mã giảm giá từ GrabFood và ShopeeFood.</p>
      
      <button class="bcast-btn" id="btnGoogle" style="max-width: 320px; font-size: 16px; padding: 18px;">
        <svg width="24" height="24" viewBox="0 0 24 24" style="background:#fff;border-radius:50%;padding:2px"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        <span>Đăng nhập với Google</span>
      </button>
      <div style="font-size: 12px; color: var(--t3); margin-top: 15px;">Miễn phí sử dụng. Đăng nhập an toàn qua Google.</div>
    </div>
    
    <div style="display:flex; justify-content:center; width:100%;">
      <div class="landing-benefits">
        <div class="benefit-card">
          <div class="bc-icon">💸</div>
          <div class="bc-title">Chia Sẻ Phí Ship</div>
          <div class="bc-desc">Không còn lo phí ship cao khi đặt ít món. Gom đơn cùng mọi người xung quanh để chia đều phí giao hàng.</div>
        </div>
        <div class="benefit-card">
          <div class="bc-icon">🎯</div>
          <div class="bc-title">Tối Ưu Mã Giảm Giá</div>
          <div class="bc-desc">Dễ dàng đạt được các mốc ưu đãi lớn (ví dụ giảm 50k cho đơn 150k) mà một người đặt khó có thể đạt được.</div>
        </div>
        <div class="benefit-card">
          <div class="bc-icon">📍</div>
          <div class="bc-title">Khám Phá Quanh Đây</div>
          <div class="bc-desc">Tính năng Radar cho phép bạn tìm kiếm và nhận thông báo các đơn gom đang mở xung quanh vị trí của bạn theo thời gian thực.</div>
        </div>
      </div>
    </div>
  </div>`;
  document.getElementById('btnGoogle').onclick = signInGoogle;
  document.getElementById('authThemeBtn').onclick = toggleTheme;
}

/* ═══════════════════════════════════════════════════════════
   RENDER: ONBOARDING (first sign-in, no circles yet)
═══════════════════════════════════════════════════════════ */
function renderOnboarding() {
  const scr = document.getElementById('screen');
  scr.classList.add('is-app');
  scr.classList.remove('has-sidebar');
  scr.innerHTML = `
  <div class="onboarding-container">
    <div class="onboarding-header">
      <div class="onboarding-wave">👋</div>
      <h2 class="onboarding-title">Chào ${firstName()}!</h2>
      <p class="onboarding-subtitle">Tạo nhóm mới hoặc nhập mã mời để tham gia nhóm của bạn bè</p>
    </div>
    <div class="onboarding-card">
      <div class="onboarding-card-title">🏢 Tạo nhóm mới</div>
      <input id="obName" class="cm-input" placeholder="Tên nhóm (vd: Dev Team Tầng 5, KTX B10 Phòng 402)" style="margin-bottom:0">
      <input id="obLoc" class="cm-input" placeholder="Địa chỉ giao hàng (vd: Phòng 502, Tòa A, Keangnam)" style="margin-bottom:0">
      <button class="bcast-btn" id="obCreate" style="font-size:13px;padding:13px">
        <div class="pulse-ring"></div>
        <span>✨ Tạo Nhóm Gom Đơn</span>
      </button>
    </div>
    <div class="onboarding-divider">
      <div class="onboarding-divider-line"></div>HOẶC<div class="onboarding-divider-line"></div>
    </div>
    <div class="onboarding-card">
      <div class="onboarding-card-title">🔗 Tham gia nhóm có sẵn</div>
      <div class="onboarding-row">
        <input id="obCode" class="cm-input" placeholder="Nhập mã mời 6 ký tự (vd: AB1C2D)" style="margin-bottom:0;flex:1;text-transform:uppercase;letter-spacing:2px">
        <button class="es-cta" id="obJoin" style="padding:10px 14px;font-size:12px;white-space:nowrap;border-radius:10px">Tham Gia</button>
      </div>
    </div>
  </div>
  <div class="toast-stack"></div>`;

  document.getElementById('obCreate').onclick = async () => {
    const name = document.getElementById('obName').value.trim();
    const loc  = document.getElementById('obLoc').value.trim();
    if (!name||!loc) { toast('⚠️ Vui lòng nhập đủ tên nhóm và địa chỉ'); return; }
    const btn = document.getElementById('obCreate');
    btn.disabled=true; btn.querySelector('span').textContent='⏳ Đang tạo…';
    try {
      const circle = await createCircle(name, loc);
      subscribeToOrders(); renderApp();
      setTimeout(()=>toast(`🎉 Đã tạo nhóm: ${circle.name}! Mã mời: ${circle.inviteCode}`), 300);
    } catch(e) {
      btn.disabled=false; btn.querySelector('span').textContent='✨ Tạo Nhóm Gom Đơn';
      toast('❌ '+e.message);
    }
  };

  document.getElementById('obJoin').onclick = async () => {
    const code = document.getElementById('obCode').value.trim();
    if (!code) { toast('⚠️ Nhập mã mời'); return; }
    const btn = document.getElementById('obJoin');
    btn.disabled=true; btn.textContent='⏳…';
    try {
      const circle = await joinCircleByCode(code);
      subscribeToOrders(); renderApp();
      setTimeout(()=>toast(`✅ Đã tham gia nhóm: ${circle.name}!`), 300);
    } catch(e) {
      btn.disabled=false; btn.textContent='Tham Gia';
      toast('❌ '+e.message);
    }
  };
}

/* ═══════════════════════════════════════════════════════════
   RENDER: MAIN APP SHELL
═══════════════════════════════════════════════════════════ */
function renderApp() {
  if (!currentUser) { renderAuth(); return; }
  if (currentScreen === 'settings') { renderSettings(document.getElementById('screen')); return; }
  const circle = curCircle();
  const scr    = document.getElementById('screen');
  scr.classList.add('is-app');
  scr.classList.add('has-sidebar');
  if (localStorage.getItem('gd_sidebar_collapsed') === 'true') {
    scr.classList.add('collapsed');
  } else {
    scr.classList.remove('collapsed');
  }

  scr.innerHTML = `

    <div class="app-bar">
      <div class="bar-brand">
        <div class="bar-logo" style="background:none;box-shadow:none;border:none"><img src="/logo.png" alt="Gom Đơn" style="width:100%;height:100%;object-fit:contain"></div>
        <span class="bar-title">Gom Đơn</span>
      </div>
      <div class="bar-right">
        <button class="bar-theme-toggle" id="manageCirclesBtn" title="Quản lý nhóm" style="font-size: 15px;">👥</button>
        <button class="bar-theme-toggle" id="themeToggleBtn">${themeIcon()}</button>
        <div class="bar-notif" id="notifBtn" title="Cài đặt cảnh báo">
          🔔
        </div>
      </div>
    </div>
    <div class="screen-body" id="screenBody"></div>
    <nav class="bottom-nav">
      <div class="sidebar-brand">
        <img src="/logo.png" alt="Gom Đơn Logo">
        <span>Gom Đơn</span>
      </div>
      <button class="nav-item ${currentTab==='home'?'on':''}" data-tab="home"><span class="ni-icon">🏠</span><span class="ni-label">Nhóm</span></button>
      <button class="nav-item ${currentTab==='nearby'?'on':''}" data-tab="nearby"><span class="ni-icon">📍</span><span class="ni-label">Gần Đây</span></button>
      <button class="nav-fab" id="fabCreate">＋</button>
      <button class="nav-item ${currentTab==='history'?'on':''}" data-tab="history"><span class="ni-icon">📋</span><span class="ni-label">Lịch Sử</span></button>
      <button class="nav-item ${currentTab==='profile'?'on':''}" data-tab="profile"><span class="ni-icon">👤</span><span class="ni-label">Tôi</span></button>
      <button class="sidebar-toggle-btn" id="sidebarCollapseBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="toggle-icon"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
    </nav>
    <div class="toast-stack"></div>`;

  scr.querySelectorAll('.nav-item[data-tab]').forEach(btn=>{
    btn.onclick=()=>{ currentTab=btn.dataset.tab; renderApp(); };
  });
  scr.querySelector('#fabCreate').onclick    = showCreateSheet;
  scr.querySelector('#manageCirclesBtn').onclick = showCircleModal;
  scr.querySelector('#themeToggleBtn').onclick = toggleTheme;
  scr.querySelector('#notifBtn').onclick     = showAlertsSettingsSheet;

  const collapseBtn = scr.querySelector('#sidebarCollapseBtn');
  if (collapseBtn) {
    collapseBtn.onclick = () => {
      const isCollapsed = scr.classList.toggle('collapsed');
      localStorage.setItem('gd_sidebar_collapsed', isCollapsed);
    };
  }

  const body = scr.querySelector('#screenBody');
  if      (currentTab==='home')    renderHomeTab(body);
  else if (currentTab==='nearby')  renderNearbyTab(body);
  else if (currentTab==='history')  renderHistoryTab(body);
  else if (currentTab==='profile') renderProfileTab(body);
}

/* ═══════════════════════════════════════════════════════════
   HOME TAB
═══════════════════════════════════════════════════════════ */
function renderHomeTab(body) {
  body.className = 'home-body';
  body.innerHTML = `
    <div class="greeting-row">
      <div class="greeting-text">
        <h2>Hôm nay ăn gì? 🍜</h2>
        <p>Xin chào, ${firstName()}!</p>
      </div>
      <img class="greeting-avatar" src="${currentUser?.photoURL||''}" id="avatarBtn" onerror="this.style.display='none'" alt="">
    </div>
    <div id="homeContent" class="home-sections-list"></div>`;
    
  body.querySelector('#avatarBtn')?.addEventListener('click',()=>{ currentTab='profile'; renderApp(); });
  
  const content = body.querySelector('#homeContent');
  if (myCircles.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🏢</div>
        <div class="es-title">Bạn chưa tham gia nhóm nào</div>
        <div class="es-desc">Hãy tạo nhóm mới hoặc nhập mã mời của bạn bè để bắt đầu gom đơn chung.</div>
        <button class="es-cta" id="esJoinCreateBtn">＋ Tham gia hoặc Tạo Nhóm</button>
      </div>`;
    content.querySelector('#esJoinCreateBtn').onclick = showCircleModal;
    return;
  }

  // Render sections for each circle
  content.innerHTML = myCircles.map(circle => {
    // Find all active orders for this circle
    const orders = circleOrders.filter(o => o.circleId === circle.id && o.status === 'collecting');
    
    return `
      <div class="circle-section" data-circle-id="${circle.id}">
        <div class="circle-section-header">
          <div class="csh-title">🏢 ${circle.name}</div>
          <button class="csh-btn btn-ghost" data-circle-id="${circle.id}" data-action="create-order" style="padding: 4px 8px; font-size: 10px; margin: 0;">
            ＋ 📢 Mở đơn gom
          </button>
        </div>
        <div class="circle-section-content" id="circleContent-${circle.id}">
          ${orders.length === 0 
            ? `
              <div class="circle-section-empty">
                <span>Chưa có đơn gom nào đang mở trong nhóm này.</span>
                <span class="es-link" data-circle-id="${circle.id}" data-action="create-order">Mở đơn ngay →</span>
              </div>
            `
            : `
              <div class="circle-orders-list" id="circleOrdersList-${circle.id}"></div>
            `
          }
        </div>
      </div>
    `;
  }).join('');

  // Bind clicks for create order buttons
  content.querySelectorAll('[data-action="create-order"]').forEach(btn => {
    btn.onclick = () => {
      const cid = btn.dataset.circleId;
      showCreateSheet(cid);
    };
  });

  // Render order cards inside their respective circle lists
  myCircles.forEach(circle => {
    const orders = circleOrders.filter(o => o.circleId === circle.id && o.status === 'collecting');
    if (orders.length > 0) {
      const listContainer = content.querySelector(`#circleOrdersList-${circle.id}`);
      if (listContainer) {
        orders.forEach(order => {
          const cardWrapper = document.createElement('div');
          cardWrapper.className = 'order-card-wrapper';
          listContainer.appendChild(cardWrapper);
          renderActiveOrderCard(cardWrapper, order);
        });
      }
    }
  });
}

function renderActiveOrderCard(container, order) {
  const isHost = order.hostUid === currentUser?.uid;
  const ppl = (order.participants || []).length;
  const isSh = order.platform === 'shopeefood';
  const isJoined = (order.participants || []).some(p => p.uid === currentUser?.uid);
  
  container.innerHTML = `
    <div class="order-card">
      <div class="oc-header ${isSh?'shopee-bg':'grab-bg'}">
        <div class="oc-icon">${order.emoji}</div>
        <div class="oc-info">
          <div class="oc-rest">${order.restaurant}</div>
          <div class="oc-sub">${order.circleName||curCircle()?.name||''} · ${ppl} người tham gia</div>
          <div style="margin-top:5px"><span class="status-chip ${order.status}">${statusVN(order.status)}</span></div>
        </div>
        <span class="oc-plat ${isSh?'shopeefood':'grab'}">${isSh?'SHOPEE':'GRAB'}</span>
      </div>
      <div class="oc-body">
        <div class="oc-left-col">
          <button class="join-btn-main ${isSh?'shopee':'grab'}" id="openAppBtn" style="margin-bottom: 8px">
            🚀 Mở Grab/Shopee &amp; Chọn Món
          </button>
          
          <div style="background:var(--s3);border:1px solid var(--border);border-radius:12px;padding:12px">
            <div style="font-size:11px;font-weight:800;color:var(--t1);margin-bottom:8px">👥 Thành viên (${ppl})</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" id="participantsList">
              ${(order.participants || []).map(p => `
                <div style="display:flex;align-items:center;gap:6px;background:var(--s2);border:1px solid var(--border);border-radius:20px;padding:3px 8px;font-size:10px">
                  <img src="${p.avatar || ''}" onerror="this.style.display='none'" style="width:18px;height:18px;border-radius:50%;object-fit:cover">
                  <span style="color:var(--t1)">${p.name.split(' ').pop()}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="order-actions" style="margin-top: 8px">
            ${isHost 
              ? `<button class="btn-primary grab" id="closeOrderBtn" style="justify-content:center">🔒 Đóng đơn gom</button>
                 <button class="btn-ghost" id="cancelOrderBtn" style="color:#ff6b6b;border-color:rgba(255,107,107,0.2);justify-content:center">🗑️ Hủy đơn</button>` 
              : isJoined 
                ? `<button class="btn-ghost" id="leaveOrderBtn" style="width:100%;justify-content:center;color:#ff6b6b;border-color:rgba(255,107,107,0.2)">✕ Hủy tham gia</button>` 
                : `<button class="btn-primary ${isSh?'shopee':'grab'}" id="joinOrderBtn" style="justify-content:center">🍜 Đăng ký tham gia</button>`
            }
            <button class="btn-ghost" style="width:100%;justify-content:center;margin-top:2px" id="shareBtn">🔗 Chia sẻ link nhóm</button>
          </div>
        </div>
        <div class="oc-right-col chat-col">
          <div style="font-size:11px;font-weight:800;color:var(--t1);margin-bottom:4px">💬 Trò chuyện nhóm</div>
          <div class="chat-box" id="chatBox">
            ${(order.messages || []).length === 0 
              ? `<div class="no-items" style="margin:auto">Chưa có tin nhắn nào. Chat để hẹn địa điểm và ck tiền nhé!</div>` 
              : (order.messages || []).map(m => {
                  const isMe = m.uid === currentUser?.uid;
                  return `
                    <div class="chat-msg ${isMe?'me':''}">
                      <img class="chat-msg-av" src="${m.avatar||''}" onerror="this.style.display='none'" alt="">
                      <div class="chat-msg-body">
                        <div class="chat-msg-sender">${m.name.split(' ').pop()}</div>
                        <div class="chat-msg-text">${m.text}</div>
                      </div>
                    </div>
                  `;
                }).join('')}
          </div>
          <div class="chat-input-wrap">
            <input class="cm-input" id="chatInput" placeholder="Nhập tin nhắn..." style="flex:1;margin:0" autocomplete="off">
            <button class="es-cta" id="chatSendBtn" style="padding:9px 15px;font-size:11px;border-radius:10px">Gửi</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#openAppBtn').onclick = () => {
    window.open(order.link, '_blank');
    if (!isJoined) {
      joinOrderDirect(order.id).then(() => renderApp()).catch(e => toast('❌ ' + e.message));
    }
  };

  const joinBtn = container.querySelector('#joinOrderBtn');
  if (joinBtn) {
    joinBtn.onclick = async () => {
      joinBtn.disabled = true;
      try {
        await joinOrderDirect(order.id);
        toast('✅ Đã tham gia đơn gom!');
        renderApp();
      } catch (e) {
        joinBtn.disabled = false;
        toast('❌ ' + e.message);
      }
    };
  }

  const leaveBtn = container.querySelector('#leaveOrderBtn');
  if (leaveBtn) {
    leaveBtn.onclick = async () => {
      if (!confirm('Bạn có chắc muốn rời đơn gom này?')) return;
      leaveBtn.disabled = true;
      try {
        await leaveOrderDirect(order.id);
        toast('❌ Đã rời đơn gom');
        renderApp();
      } catch (e) {
        leaveBtn.disabled = false;
        toast('❌ ' + e.message);
      }
    };
  }

  const closeBtn = container.querySelector('#closeOrderBtn');
  if (closeBtn) {
    closeBtn.onclick = async () => {
      if (!confirm('Đóng đơn gom này? Thành viên sẽ không thể tham gia nữa.')) return;
      closeBtn.disabled = true;
      try {
        await archiveOrder(order.id);
        toast('🔒 Đã đóng đơn gom!');
        renderApp();
      } catch (e) {
        closeBtn.disabled = false;
        toast('❌ ' + e.message);
      }
    };
  }

  const cancelBtn = container.querySelector('#cancelOrderBtn');
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      if (!confirm('Hủy bỏ hoàn toàn đơn gom này?')) return;
      cancelBtn.disabled = true;
      try {
        await cancelOrder(order.id);
        toast('🗑️ Đã hủy đơn gom');
        renderApp();
      } catch (e) {
        cancelBtn.disabled = false;
        toast('❌ ' + e.message);
      }
    };
  }

  container.querySelector('#shareBtn').onclick = () => {
    const circle = curCircle();
    const msg = `🍜 Đơn gom tại ${order.restaurant}!\nTham gia link: ${order.link}\nNhóm: ${circle?.name||''}`;
    if (navigator.share) navigator.share({ title: 'Gom Đơn', text: msg });
    else { navigator.clipboard?.writeText(order.link); toast('📋 Đã copy link đặt món!'); }
  };

  const chatInput = container.querySelector('#chatInput');
  const chatSendBtn = container.querySelector('#chatSendBtn');
  
  const sendMessage = async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    try {
      await sendOrderMessage(order.id, text);
    } catch (e) {
      toast('❌ Lỗi gửi tin nhắn: ' + e.message);
    }
  };

  chatSendBtn.onclick = sendMessage;
  chatInput.onkeydown = e => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const chatBox = container.querySelector('#chatBox');
  if (chatBox) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

/* ═══════════════════════════════════════════════════════════
   NEARBY TAB
═══════════════════════════════════════════════════════════ */
async function renderNearbyTab(body) {
  body.className = 'nearby-body';
  body.innerHTML = `
    <div class="radar-hdr">
      <div class="radar-ico">📡</div>
      <div class="radar-text"><h4>Đang tìm đơn…</h4><p>Đang kết nối máy chủ…</p></div>
      <div class="radar-count">…</div>
    </div>
    <div style="text-align:center;padding:40px;color:var(--t3);font-size:11px">Đang tải…</div>`;
  try {
    await loadNearbyOrders();
    displayNearby(body);
  } catch(e) {
    // Show a friendly error with retry button instead of raw message
    body.className = 'nearby-body';
    body.innerHTML = `
      <div class="radar-hdr" style="border-color:rgba(239,68,68,.2);background:rgba(239,68,68,.04)">
        <div class="radar-ico" style="background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.25)">⚠️</div>
        <div class="radar-text">
          <h4 style="color:var(--t1)">Không tải được đơn</h4>
          <p>${e.message && e.message.includes('index') ? 'Firestore đang chuẩn bị — thử lại sau vài giây' : (e.message||'Lỗi kết nối')}</p>
        </div>
      </div>
      <button class="bcast-btn" style="margin-top:4px;font-size:13px" onclick="currentTab='nearby';renderApp()">🔄 Thử lại</button>`;
  }
}

function displayNearby(body) {
  const filtered = nearbyOrders.filter(o=>{
    if (nearbyFilter==='grab')   return o.platform==='grab';
    if (nearbyFilter==='shopee') return o.platform==='shopeefood';
    return true;
  });
  body.innerHTML = `
    <div class="radar-hdr">
      <div class="radar-ico">📡</div>
      <div class="radar-text"><h4>Đơn gom trong ${alertRadius}m</h4><p>${filtered.length} đơn đang mở${userLocation?'':' (vị trí chưa xác định)'}</p></div>
      <div class="radar-count">${filtered.length}</div>
    </div>
    <div class="nearby-filters">
      <button class="nf-chip ${nearbyFilter==='all'?'on':''}" data-f="all">🗂️ Tất cả</button>
      <button class="nf-chip ${nearbyFilter==='grab'?'on':''}" data-f="grab">🍜 GrabFood</button>
      <button class="nf-chip ${nearbyFilter==='shopee'?'on':''}" data-f="shopee">🧋 ShopeeFood</button>
    </div>
    <div id="nbList">
      ${filtered.length===0
        ?`<div class="empty-state" style="min-height:160px"><div class="es-icon">📡</div><div class="es-title">Không có đơn trong ${alertRadius}m</div><div class="es-desc">Tăng bán kính tìm kiếm hoặc chờ bạn bè mở đơn mới.</div></div>`
        :filtered.map(o=>buildNearbyCard(o)).join('')
      }
    </div>`;
  body.querySelectorAll('.nf-chip').forEach(c=>{
    c.onclick=()=>{ nearbyFilter=c.dataset.f; displayNearby(body); };
  });
  body.querySelectorAll('.nc-join').forEach(btn=>{
    btn.onclick=async()=>{
      const o=nearbyOrders.find(n=>n.id===btn.dataset.id);
      if(!o) return;
      btn.disabled = true;
      try {
        const isMember = myCircles.some(c => c.id === o.circleId);
        if (!isMember) {
          await joinCircleDirect(o.circleId);
        }
        await joinOrderDirect(o.id);
        currentCircleId = o.circleId;
        subscribeToOrders();
        currentTab = 'home';
        renderApp();
        window.open(o.link, '_blank');
        toast(`✅ Đã tham gia nhóm và mở Grab/Shopee!`);
      } catch(e) {
        btn.disabled = false;
        toast('❌ ' + e.message);
      }
    };
  });
  body.querySelectorAll('.nc-bell').forEach(btn=>{
    btn.onclick=()=>{
      const o=nearbyOrders.find(n=>n.id===btn.dataset.id); if(!o) return;
      o._alert=!o._alert; btn.textContent=o._alert?'🔔':'🔕'; btn.classList.toggle('active',o._alert);
      toast(o._alert?`🔔 Bật cảnh báo cho ${o.restaurant}`:'🔕 Tắt cảnh báo');
    };
  });
}

function buildNearbyCard(o) {
  const ppl  = (o.participants||[]).length;
  const isSh = o.platform==='shopeefood';
  return `<div class="nc">
    <div class="nc-top">
      <div class="nc-logo">${o.emoji||'🍜'}<span class="dist-badge ${o.distClass||'mid'}">${o.distLabel||'?'}</span></div>
      <div class="nc-info">
        <div class="nc-rest">${o.restaurant}</div>
        <div class="nc-circle"><span style="width:5px;height:5px;border-radius:50%;background:var(--blue);display:inline-block;flex-shrink:0"></span>&nbsp;${o.hostName?.split(' ').pop()||''} · ${o.circleName||'Nhóm khác'}</div>
      </div>
      <div class="nc-right">
        <span class="nc-plat ${isSh?'shopee':'grab'}">${isSh?'SHOPEE':'GRAB'}</span>
        <span class="nc-time">⏱ ${timeAgoVN(o.createdAt)}</span>
      </div>
    </div>
    <div class="nc-prog" style="border-bottom:none">
      <div class="nc-prog-row" style="margin-top:0"><span class="nc-ppl">👥 ${ppl} người đang tham gia</span></div>
    </div>
    <div class="nc-actions">
      <button class="nc-join ${isSh?'shopee':'grab'}" data-id="${o.id}">🍜 Mở App &amp; Tham Gia</button>
      <div class="nc-bell ${o._alert?'active':''}" data-id="${o.id}">${o._alert?'🔔':'🔕'}</div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   ALERTS TAB
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   LỊCH SỬ TAB
═══════════════════════════════════════════════════════════ */
async function renderHistoryTab(body) {
  body.className = 'history-body';
  body.innerHTML = `
    <div class="history-hdr">
      <div class="history-ico">📋</div>
      <div class="history-text"><h4>Lịch sử đơn gom</h4><p>Danh sách các đơn gom bạn đã tham gia hoặc tự mở</p></div>
    </div>
    <div style="text-align:center;padding:40px;color:var(--t3);font-size:11px">Đang tải lịch sử…</div>`;
  try {
    const history = await loadOrdersHistory();
    displayHistory(body, history);
  } catch(e) {
    body.innerHTML = `
      <div class="history-hdr" style="border-color:rgba(239,68,68,.2);background:rgba(239,68,68,.04)">
        <div class="history-ico" style="background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.25)">⚠️</div>
        <div class="history-text">
          <h4 style="color:var(--t1)">Không tải được lịch sử</h4>
          <p>${e.message||'Lỗi kết nối'}</p>
        </div>
      </div>
      <button class="bcast-btn" style="margin-top:4px;font-size:13px" onclick="currentTab='history';renderApp()">🔄 Thử lại</button>`;
  }
}

function displayHistory(body, history) {
  const filtered = history.filter(o => {
    const isHost = o.hostUid === currentUser?.uid;
    const isMember = (o.items || []).some(it => it.uid === currentUser?.uid);
    if (historyFilter === 'host') return isHost;
    if (historyFilter === 'joined') return isMember;
    return isHost || isMember;
  });
  
  body.innerHTML = `
    <div class="history-hdr">
      <div class="history-ico">📋</div>
      <div class="history-text"><h4>Lịch sử đơn gom</h4><p>Tổng số ${filtered.length} đơn</p></div>
    </div>
    <div class="history-filters">
      <button class="hf-chip ${historyFilter==='all'?'on':''}" data-f="all">🗂️ Tất cả</button>
      <button class="hf-chip ${historyFilter==='host'?'on':''}" data-f="host">👑 Tôi gom</button>
      <button class="hf-chip ${historyFilter==='joined'?'on':''}" data-f="joined">🍜 Tôi chung</button>
    </div>
    <div id="histList">
      ${filtered.length===0
        ? `<div class="empty-state" style="min-height:160px"><div class="es-icon">📋</div><div class="es-title">Chưa có đơn gom nào</div><div class="es-desc">Các đơn hàng bạn gom chung hoặc tự gom sẽ hiển thị ở đây.</div></div>`
        : filtered.map(o => buildHistoryCard(o)).join('')
      }
    </div>
    <div class="history-summary-col">
      <div class="alert-settings-card" style="margin-top:0">
        <div class="asc-title">📊 Tổng Quan Lịch Sử</div>
        <div class="settings-row" style="padding: 10px 0; border-bottom: 1px solid var(--row-border)">
          <div class="sr-label">Đơn đã tham gia</div>
          <div style="font-weight:800;color:var(--t1)">${userProfile?.stats?.ordersJoined||0}</div>
        </div>
        <div class="settings-row" style="padding: 10px 0; border-bottom: 1px solid var(--row-border)">
          <div class="sr-label">Tổng tiền tiết kiệm</div>
          <div style="font-weight:800;color:var(--grab)">${vnd(userProfile?.stats?.savedTotal||0)}</div>
        </div>
        <div class="settings-row" style="padding: 10px 0">
          <div class="sr-label">Nhóm hoạt động</div>
          <div style="font-weight:800;color:var(--acc)">${myCircles.length} nhóm</div>
        </div>
      </div>
    </div>`;
    
  body.querySelectorAll('.hf-chip').forEach(c => {
    c.onclick = () => { historyFilter = c.dataset.f; displayHistory(body, history); };
  });
  
  body.querySelectorAll('.hc-card').forEach(card => {
    card.onclick = () => {
      const cid = card.dataset.cid;
      const cname = card.dataset.cname;
      currentCircleId = cid;
      db?.collection('users').doc(currentUser.uid).update({lastCircleId: cid}).catch(()=>{});
      subscribeToOrders();
      currentTab = 'home';
      renderApp();
      toast(`✅ Đã chuyển đến nhóm: ${cname}`);
    };
  });
}

function buildHistoryCard(o) {
  const isHost = o.hostUid === currentUser?.uid;
  const ppl = (o.items || []).length + 1;
  const isSh = o.platform === 'shopeefood';
  const roleBadge = isHost 
    ? `<span class="hc-role host">Host 👑</span>` 
    : `<span class="hc-role member">Chung 🍜</span>`;
  
  let myOrderText = '';
  if (isHost) {
    myOrderText = 'Chủ đơn (Gom món)';
  } else {
    const myItems = (o.items || []).filter(it => it.uid === currentUser?.uid);
    if (myItems.length > 0) {
      myOrderText = `Bạn đặt: ${myItems.map(it => it.itemName).join(', ')}`;
    }
  }

  const dateStr = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate().toLocaleDateString('vi-VN') : new Date(o.createdAt).toLocaleDateString('vi-VN')) : 'Vừa xong';

  return `
    <div class="hc-card" data-cid="${o.circleId}" data-cname="${o.circleName || 'Nhóm'}">
      <div class="hc-top">
        <div class="hc-logo">${o.emoji || '🍜'}</div>
        <div class="hc-info">
          <div class="hc-rest">${o.restaurant}</div>
          <div class="hc-circle">${o.circleName || 'Nhóm'} · ${dateStr}</div>
        </div>
        <div class="hc-right">
          <span class="status-chip ${o.status}">${statusVN(o.status)}</span>
        </div>
      </div>
      <div class="hc-body-row">
        <div class="hc-stats">
          <span>👥 ${ppl} người</span>
          <span>·</span>
          <strong>${vnd(o.total || 0)}</strong>
        </div>
        ${roleBadge}
      </div>
      ${myOrderText ? `<div class="hc-preview">${myOrderText}</div>` : ''}
    </div>
  `;
}


/* ═══════════════════════════════════════════════════════════
   PROFILE TAB
═══════════════════════════════════════════════════════════ */
function renderProfileTab(body) {
  body.className = 'profile-body';
  const u      = currentUser;
  const prof   = userProfile;
  const circle = curCircle();
  body.innerHTML = `
    <div class="profile-left-col">
      <div class="profile-hero">
        <div class="prof-av-wrap">
          <img class="prof-av" src="${u?.photoURL||''}" onerror="this.style.display='none'" alt="">
          <div class="prof-provider-badge google"><svg width="12" height="12" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg></div>
        </div>
        <div class="prof-name">${u?.displayName||''}</div>
        <div class="prof-email">${u?.email||''}</div>
      </div>
      <div class="prof-stats" style="margin-top:14px">
        <div class="ps-col"><div class="ps-num">${prof?.stats?.ordersJoined||0}</div><div class="ps-lbl">Đơn đã gom</div></div>
        <div class="ps-col"><div class="ps-num">${prof?.stats?.savedTotal>=1000?Math.round((prof.stats.savedTotal||0)/1000)+'k':vnd(prof?.stats?.savedTotal||0)}</div><div class="ps-lbl">Tiết kiệm</div></div>
        <div class="ps-col"><div class="ps-num">${myCircles.length}</div><div class="ps-lbl">Nhóm</div></div>
      </div>
    </div>
    <div class="profile-right-col">
      <div class="prof-section" style="padding-top:14px">
        <div class="section-label">Nhóm của tôi</div>
        ${myCircles.map(c=>`
          <div class="circle-item-row ${c.id===currentCircleId?'active':''}" data-cid="${c.id}">
            <div class="cir-icon">🏢</div>
            <div class="cir-info"><div class="cir-name">${c.name}</div><div class="cir-loc">${c.location||''}</div></div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
              ${c.id===currentCircleId?'<span style="font-size:9px;color:var(--grab);font-weight:700">✓ Đang chọn</span>':''}
              ${c.inviteCode?'<span class="code-copy" data-code="'+c.inviteCode+'" style="font-size:9px;color:var(--acc);font-weight:800;cursor:pointer;letter-spacing:1px">📋 '+c.inviteCode+'</span>':''}
            </div>
          </div>`).join('')}
        <button class="add-circle-btn" id="addCircleBtn">＋ &nbsp;Tham gia hoặc tạo nhóm mới</button>
      </div>
      <div class="prof-section">
        <div class="section-label">Tài khoản</div>
        <div class="settings-link-row" id="goSettings">
          <div class="slr-icon" style="background:rgba(59,130,246,.1)">⚙️</div>
          <div><div class="slr-label">Cài đặt</div><div class="slr-sub">Thông báo, bán kính, giao diện</div></div>
          <span class="slr-chev">›</span>
        </div>
        ${circle?`<div class="settings-link-row" id="shareInviteBtn">
          <div class="slr-icon" style="background:rgba(52,211,153,.1)">🔗</div>
          <div><div class="slr-label">Chia sẻ mã mời nhóm</div><div class="slr-sub">Gửi cho bạn bè để họ tham gia nhóm này</div></div>
          <span class="slr-val">${circle.inviteCode||''}</span>
        </div>`:''}
        <div class="settings-link-row" id="shareAppRow">
          <div class="slr-icon" style="background:rgba(255,159,28,.1)">🎁</div>
          <div><div class="slr-label">Chia sẻ ứng dụng</div><div class="slr-sub">Giới thiệu Gom Đơn cho bạn bè</div></div>
          <span class="slr-chev">›</span>
        </div>
      </div>
      <div class="prof-section"><button class="logout-btn" id="logoutBtn">🚪 Đăng xuất</button></div>
    </div>`;
  body.querySelectorAll('.circle-item-row').forEach(el=>{
    el.onclick=()=>{
      const cid=el.dataset.cid;
      currentCircleId=cid;
      db?.collection('users').doc(currentUser.uid).update({lastCircleId:cid}).catch(()=>{});
      subscribeToOrders(); currentTab='home'; renderApp();
      toast(`✅ Chuyển sang: ${myCircles.find(c=>c.id===cid)?.name}`);
    };
  });
  body.querySelectorAll('.code-copy').forEach(el=>{
    el.onclick=e=>{ e.stopPropagation(); navigator.clipboard?.writeText(el.dataset.code); toast('📋 Đã sao chép mã mời!'); };
  });
  body.querySelector('#goSettings').onclick=()=>{ currentScreen='settings'; renderApp(); };
  body.querySelector('#logoutBtn').onclick=signOutUser;
  body.querySelector('#addCircleBtn').onclick=showCircleModal;
  body.querySelector('#shareInviteBtn')?.addEventListener('click',()=>{
    const url=location.href.split('?')[0]+'?join='+circle.inviteCode;
    if (navigator.share) navigator.share({title:'Gom Đơn – Tham gia nhóm',text:`Mình đang dùng Gom Đơn gom đơn cùng nhau. Vào đây nhé: ${url}`});
    else { navigator.clipboard?.writeText(url); toast(`📋 Đã sao chép link mời: ${url}`); }
  });
  body.querySelector('#shareAppRow')?.addEventListener('click',()=>{
    const url=location.href.split('?')[0];
    if (navigator.share) navigator.share({title:'Gom Đơn',text:'Ứng dụng gom đơn thức ăn, chia sẻ phí ship!',url});
    else { navigator.clipboard?.writeText(url); toast('📋 Đã sao chép link app!'); }
  });
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS SCREEN
═══════════════════════════════════════════════════════════ */
function renderSettings(scr) {
  scr.classList.add('is-app');
  scr.classList.remove('has-sidebar');
  scr.innerHTML = `
    
    <div class="settings-back-bar" id="settingsBack">
      <div class="sb-back-ico">‹</div>
      <div class="sb-back-label">Cài Đặt</div>
    </div>
    <div class="settings-body">
      <div class="sg-section">
        <div class="sg-title">Thông báo</div>
        <div class="sg-row">
          <div class="sg-ico" style="background:rgba(0,177,79,.1)">🔔</div>
          <div class="sg-text"><span>Cảnh báo đơn gom</span><small>Nhận thông báo khi có đơn gần bạn</small></div>
          <input type="checkbox" class="sw-input" id="stAlert" ${alertEnabled?'checked':''}>
        </div>
        <div class="sg-row">
          <div class="sg-ico" style="background:rgba(59,130,246,.1)">📡</div>
          <div class="sg-text"><span>Bán kính hiện tại</span><small>${alertRadius}m quanh bạn</small></div>
          <span class="slr-val">${alertRadius}m</span>
        </div>
      </div>
      <div class="sg-section">
        <div class="sg-title">Giao diện</div>
        <div class="sg-row" id="stThemeRow" style="cursor:pointer">
          <div class="sg-ico" style="background:rgba(255,159,28,.1)">${themeIcon()}</div>
          <div class="sg-text"><span>Chế độ ${theme==='dark'?'Tối 🌙':'Sáng ☀️'}</span><small>Nhấn để chuyển sang chế độ ${theme==='dark'?'sáng':'tối'}</small></div>
          <span class="slr-chev">›</span>
        </div>
      </div>
      <div class="sg-section">
        <div class="sg-title">Tài khoản</div>
        <div class="sg-row">
          <div class="sg-ico" style="background:rgba(59,130,246,.1)">👤</div>
          <div class="sg-text"><span>Google Account</span><small>${currentUser?.email||'—'}</small></div>
        </div>
        <div class="sg-row" id="stLogout" style="cursor:pointer">
          <div class="sg-ico" style="background:rgba(239,68,68,.08)">🚪</div>
          <div class="sg-text"><span style="color:#ff6b6b">Đăng xuất</span></div>
        </div>
      </div>
      <div class="sg-section">
        <div class="sg-title">Ứng dụng</div>
        <div class="sg-row">
          <div class="sg-ico" style="background:rgba(107,114,128,.1)">ℹ️</div>
          <div class="sg-text"><span>Phiên bản</span><small>Gom Đơn – Phiên bản chính thức</small></div>
          <span class="slr-val">v2.0.0</span>
        </div>
      </div>
    </div>
    <div class="toast-stack"></div>`;

  document.getElementById('settingsBack').onclick=()=>{ currentScreen='main'; renderApp(); };
  document.getElementById('stAlert').onchange=e=>{ alertEnabled=e.target.checked; };
  document.getElementById('stThemeRow').onclick=toggleTheme;
  document.getElementById('stLogout').onclick=signOutUser;
}

function showAlertsSettingsSheet() {
  const scr = document.getElementById('screen');
  scr.querySelector('.sheet-scrim')?.remove();
  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';
  scrim.innerHTML = `
    <div class="sheet-box">
      <div class="sh-handle"></div>
      <div class="sh-title" style="margin-bottom: 8px">Cài Đặt Cảnh Báo 📡</div>
      <div class="alert-settings-card" style="border: none; background: transparent; padding: 0">
        <div class="settings-row" style="margin-bottom: 12px">
          <div>
            <div class="sr-label">Bật cảnh báo đơn gom</div>
            <div class="sr-sub">Nhận thông báo khi có đơn gần bạn</div>
          </div>
          <input type="checkbox" class="sw-input" id="alertToggle" ${alertEnabled?'checked':''}>
        </div>
        <div style="margin-bottom: 12px">
          <div class="sr-label" style="margin-bottom:8px">Bán kính tìm kiếm</div>
          <div class="chip-group">
            <button class="sm-chip blue ${alertRadius===50?'on':''}" data-r="50">📡 50m</button>
            <button class="sm-chip blue ${alertRadius===100?'on':''}" data-r="100">📡 100m</button>
            <button class="sm-chip blue ${alertRadius===200?'on':''}" data-r="200">📡 200m</button>
            <button class="sm-chip blue ${alertRadius===500?'on':''}" data-r="500">📡 500m</button>
          </div>
        </div>
        <div style="margin-bottom: 12px">
          <div class="sr-label" style="margin-bottom:8px">Khung giờ cảnh báo</div>
          <div class="chip-group">
            <button class="sm-chip ${alertTimeWindows.has('morning')?'on':''}" data-tw="morning">🌅 7–9h</button>
            <button class="sm-chip ${alertTimeWindows.has('lunch')?'on':''}" data-tw="lunch">☀️ 11–13h</button>
            <button class="sm-chip ${alertTimeWindows.has('dinner')?'on':''}" data-tw="dinner">🌆 17–19h</button>
            <button class="sm-chip ${alertTimeWindows.has('allday')?'on':''}" data-tw="allday">🕐 Cả ngày</button>
          </div>
        </div>
      </div>
      <button class="dl-cancel" id="sheetClose" style="margin-top: 8px">Đóng</button>
    </div>`;
  scr.appendChild(scrim);
  
  scrim.querySelector('#alertToggle').onchange = e => {
    alertEnabled = e.target.checked;
    toast(alertEnabled ? '🔔 Cảnh báo bật' : '🔕 Cảnh báo tắt');
  };
  
  scrim.querySelectorAll('[data-r]').forEach(btn => {
    btn.onclick = () => {
      alertRadius = +btn.dataset.r;
      scrim.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('on', +b.dataset.r === alertRadius));
      toast(`📡 Bán kính: ${alertRadius}m`);
    };
  });
  
  scrim.querySelectorAll('[data-tw]').forEach(btn => {
    btn.onclick = () => {
      const tw = btn.dataset.tw;
      if (alertTimeWindows.has(tw)) alertTimeWindows.delete(tw);
      else alertTimeWindows.add(tw);
      btn.classList.toggle('on', alertTimeWindows.has(tw));
    };
  });
  
  scrim.querySelector('#sheetClose').onclick = () => scrim.remove();
  scrim.onclick = e => { if (e.target === scrim) scrim.remove(); };
}

/* ═══════════════════════════════════════════════════════════
   CREATE ORDER SHEET
═══════════════════════════════════════════════════════════ */
function showCreateSheet(circleId) {
  const targetCircleId = circleId && typeof circleId === 'string' ? circleId : currentCircleId;
  const scr = document.getElementById('screen');
  scr.querySelector('.sheet-scrim')?.remove();
  const scrim = document.createElement('div');
  scrim.className='sheet-scrim';
  scrim.innerHTML=`
    <div class="sheet-box">
      <div class="sh-handle"></div>
      <div class="sh-title">Tạo Đơn Gom 📢</div>
      
      <div style="margin-bottom: 8px">
        <label style="font-size:10px;font-weight:800;color:var(--t3);display:block;margin-bottom:4px">Nhóm nhận đơn gom:</label>
        <select class="cm-input" id="circleSelect" style="margin: 0; padding: 10px; font-size:12px; cursor: pointer; border-radius:10px;">
          ${myCircles.map(c => `<option value="${c.id}" ${c.id === targetCircleId ? 'selected' : ''}>🏢 ${c.name}</option>`).join('')}
        </select>
      </div>

      <div class="sh-sub" style="margin-top: 4px">Mở link group order trong app Grab/ShopeeFood, sao chép and dán vào đây</div>
      <div class="link-wrap">
        <input class="link-input" id="linkInput" placeholder="Dán link đơn nhóm Grab hoặc ShopeeFood vào đây…" autocomplete="off">
        <button class="link-paste" id="pasteBtn" title="Dán từ clipboard">📋</button>
      </div>
      <div class="plat-chips">
        <button class="plat-chip-btn grab-chip" id="fillGrab">🍜 Demo: Link Grab</button>
        <button class="plat-chip-btn shopee-chip" id="fillShopee">🧋 Demo: Link Shopee</button>
      </div>
      <button class="bcast-btn" id="broadcastBtn">
        <div class="pulse-ring"></div>
        <span>📢 Gom Đơn Với Nhóm!</span>
      </button>
      <button class="dl-cancel" id="sheetClose">Hủy</button>
    </div>`;
  scr.appendChild(scrim);
  scrim.querySelector('#pasteBtn').onclick=async()=>{
    try{ const t=await navigator.clipboard.readText(); scrim.querySelector('#linkInput').value=t; }
    catch(e){ toast('⚠️ Không đọc được clipboard'); }
  };
  scrim.querySelector('#fillGrab').onclick=()=>{ scrim.querySelector('#linkInput').value='https://r.grab.com/g/s/group-order-demo-'+Date.now(); };
  scrim.querySelector('#fillShopee').onclick=()=>{ scrim.querySelector('#linkInput').value='https://shopeefood.vn/share/group/'+Date.now(); };
  scrim.querySelector('#sheetClose').onclick=()=>scrim.remove();
  scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  scrim.querySelector('#broadcastBtn').onclick=async()=>{
    const link=scrim.querySelector('#linkInput').value.trim();
    const selCircleId=scrim.querySelector('#circleSelect').value;
    if(!link){ toast('⚠️ Hãy dán link trước!'); return; }
    if(!selCircleId){ toast('⚠️ Bạn chưa chọn nhóm nào!'); return; }
    const btn=scrim.querySelector('#broadcastBtn');
    btn.disabled=true; btn.innerHTML='<span>⏳ Đang tạo đơn…</span>';
    try{
      const platform=detectPlatform(link);
      let lat=null,lng=null;
      try{ const pos=await getUserLocation(); lat=pos.lat; lng=pos.lng; }catch(e){}
      await createOrder(link,platform,lat,lng,selCircleId);
      scrim.remove(); currentTab='home'; renderApp();
      setTimeout(()=>toast(`🍜 Đã mở đơn gom! Mọi người trong nhóm sẽ thấy ngay.`),300);
    }catch(e){
      btn.disabled=false; btn.innerHTML='<div class="pulse-ring"></div><span>📢 Gom Đơn Với Nhóm!</span>';
      toast('❌ '+e.message);
    }
  };
}

/* showDeepLink is deprecated as items are picked natively on Grab/Shopee apps */

/* ═══════════════════════════════════════════════════════════
   CIRCLE MODAL
═══════════════════════════════════════════════════════════ */
function showCircleModal() {
  const scr = document.getElementById('screen');
  scr.querySelector('.cm-scrim')?.remove();
  const scrim=document.createElement('div'); scrim.className='cm-scrim';
  scrim.innerHTML=`
    <div class="cm-box">
      <div class="cm-hdr"><h3>👥 Quản lý Nhóm</h3><button class="cm-x" id="cmClose">✕</button></div>
      <div class="cm-body">
        ${myCircles.length?`<div style="display:flex;flex-direction:column;gap:6px">
          ${myCircles.map(c=>`<div class="ci-row" data-id="${c.id}" style="cursor:pointer">
            <div><div class="ci-name">${c.name}</div><div class="ci-loc">${c.location||''}</div></div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              ${c.inviteCode?`<span class="code-ic" data-ic="${c.inviteCode}" style="font-size:10px;color:var(--acc);font-weight:800;letter-spacing:1px;background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:3px 8px">📋 Mã: ${c.inviteCode}</span>`:''}
            </div>
          </div>`).join('')}
        </div>`:'<div style="font-size:11px;color:var(--t3);text-align:center;padding:10px">Bạn chưa ở trong nhóm nào</div>'}
        <div>
          <div style="font-size:12px;font-weight:800;color:var(--t2);margin-bottom:8px">Tham gia bằng mã mời</div>
          <div style="display:flex;gap:8px">
            <input class="cm-input" id="joinCodeInput" placeholder="Mã 6 ký tự (vd: AB1C2D)" style="flex:1;margin:0;text-transform:uppercase;letter-spacing:2px">
            <button class="cm-cta" style="width:auto;padding:10px 14px;font-size:11px" id="joinCodeBtn">Tham gia</button>
          </div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:800;color:var(--t2);margin-bottom:8px">Tạo nhóm mới</div>
          <input class="cm-input" id="newCircleName" placeholder="Tên nhóm (vd: Dev Team Tầng 5)">
          <input class="cm-input" id="newCircleLoc" placeholder="Địa chỉ giao hàng">
          <button class="cm-cta" id="createCircleBtn">＋ Tạo &amp; Tham gia</button>
        </div>
      </div>
    </div>`;
  scr.appendChild(scrim);
  scrim.querySelector('#cmClose').onclick=()=>scrim.remove();
  scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  scrim.querySelectorAll('.ci-row').forEach(el=>{
    el.onclick=()=>{
      const code = el.querySelector('.code-ic')?.dataset.ic;
      if (code) {
        navigator.clipboard?.writeText(code);
        toast('📋 Đã sao chép mã mời: ' + code);
      }
    };
  });
  scrim.querySelector('#joinCodeBtn').onclick=async()=>{
    const code=scrim.querySelector('#joinCodeInput').value.trim();
    if(!code) return;
    const btn=scrim.querySelector('#joinCodeBtn'); btn.disabled=true; btn.textContent='⏳…';
    try{
      const circle=await joinCircleByCode(code); scrim.remove(); subscribeToOrders(); renderApp();
      toast(`✅ Đã tham gia: ${circle.name}`);
    }catch(e){ btn.disabled=false; btn.textContent='Tham gia'; toast('❌ '+e.message); }
  };
  scrim.querySelector('#createCircleBtn').onclick=async()=>{
    const name=scrim.querySelector('#newCircleName').value.trim();
    const loc=scrim.querySelector('#newCircleLoc').value.trim();
    if(!name||!loc){ toast('⚠️ Điền đủ thông tin'); return; }
    const btn=scrim.querySelector('#createCircleBtn'); btn.disabled=true; btn.textContent='⏳ Đang tạo…';
    try{
      const circle=await createCircle(name,loc); scrim.remove(); subscribeToOrders(); renderApp();
      toast(`✅ Đã tạo nhóm: ${circle.name} · Mã: ${circle.inviteCode}`);
    }catch(e){ btn.disabled=false; btn.textContent='＋ Tạo & Tham gia'; toast('❌ '+e.message); }
  };
}

/* ═══════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════ */
function initTheme() {
  try{ const s=sessionStorage.getItem('gomdon_theme'); if(s) theme=s; }catch(e){}
  if(!theme && window.matchMedia?.('(prefers-color-scheme:light)').matches) theme='light';
  applyTheme();
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme',theme);
  try{ sessionStorage.setItem('gomdon_theme',theme); }catch(e){}
}
function toggleTheme() {
  theme=theme==='dark'?'light':'dark'; applyTheme();
  if(currentUser) renderApp(); else renderAuth();
  toast(theme==='light'?'☀️ Chế độ sáng':'🌙 Chế độ tối');
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
initTheme();

// Handle invite code in URL
const _urlCode = new URLSearchParams(location.search).get('join');
if (_urlCode) sessionStorage.setItem('pending_invite', _urlCode);

if (!FIREBASE_CONFIG) {
  renderSetupScreen();
} else {
  initFirebase();
}

// Live clock ticker
setInterval(()=>{ const el=document.querySelector('.sb-time'); if(el) el.textContent=nowTime(); }, 30000);
