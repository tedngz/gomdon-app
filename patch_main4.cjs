const fs = require('fs');
let code = fs.readFileSync('src/main.js', 'utf-8');

// Normalize line endings to LF for easier replacement
let normalized = code.replace(/\r\n/g, '\n');

// 1. Remove status bars
const statusBarOnboarding = `<div class="status-bar"><span class="sb-time">\${nowTime()}</span><span class="sb-icons">📶 5G 🔋</span></div>`;
normalized = normalized.replace(statusBarOnboarding, '');

const statusBarApp = `    <div class="status-bar">
      <span class="sb-time">\${nowTime()}</span>
      <span class="sb-icons">📶 5G 🔋</span>
    </div>`;
normalized = normalized.replace(statusBarApp, '');

const statusBarSettings = `<div class="status-bar"><span class="sb-time">\${nowTime()}</span><span class="sb-icons">📶 5G 🔋</span></div>`;
normalized = normalized.replace(statusBarSettings, '');


// 2. Wrap Alerts page elements in alerts-history-col
const alertsOldHTML = `    <div class="alerts-history-title">Ghi chú</div>
    <div class="alert-hist-item"><div class="ahi-icon grab">📡</div><div class="ahi-info"><div class="ahi-title">Dữ liệu thực từ Firebase</div><div class="ahi-sub">Các đơn gần đây đều là đơn thật từ người dùng thật trong bán kính của bạn.</div></div></div>
    <div class="alert-hist-item"><div class="alert-hist-item"><div class="ahi-icon shopee">📍</div><div class="ahi-info"><div class="ahi-title">Vị trí GPS</div><div class="ahi-sub">Cấp quyền vị trí để tìm đơn gom chính xác. Vị trí không được lưu lên server.</div></div></div>`;

// Let's do a more robust find & replace for Alerts InnerHTML
const alertsOldBodyStart = `function renderAlertsTab(body) {
  body.className = 'alerts-body';
  body.innerHTML = \`
    <div class="alert-settings-card">`;

const alertsOldBodyEnd = `    <div class="alerts-history-title">Ghi chú</div>
    <div class="alert-hist-item"><div class="ahi-icon grab">📡</div><div class="ahi-info"><div class="ahi-title">Dữ liệu thực từ Firebase</div><div class="ahi-sub">Các đơn gần đây đều là đơn thật từ người dùng thật trong bán kính của bạn.</div></div></div>
    <div class="alert-hist-item"><div class="ahi-icon shopee">📍</div><div class="ahi-info"><div class="ahi-title">Vị trí GPS</div><div class="ahi-sub">Cấp quyền vị trí để tìm đơn gom chính xác. Vị trí không được lưu lên server.</div></div></div>\`;`;

const alertsNewBody = `function renderAlertsTab(body) {
  body.className = 'alerts-body';
  body.innerHTML = \`
    <div class="alert-settings-card">
      <div class="asc-title">📡 Cài Đặt Cảnh Báo</div>
      <div class="settings-row">
        <div><div class="sr-label">Bật cảnh báo đơn gom</div><div class="sr-sub">Nhận thông báo khi có đơn gần bạn</div></div>
        <input type="checkbox" class="sw-input" id="alertToggle" \${alertEnabled?'checked':''}>
      </div>
      <div>
        <div class="sr-label" style="margin-bottom:8px">Bán kính tìm kiếm</div>
        <div class="chip-group">
          <button class="sm-chip blue \${alertRadius===50?'on':''}" data-r="50">📡 50m</button>
          <button class="sm-chip blue \${alertRadius===100?'on':''}" data-r="100">📡 100m</button>
          <button class="sm-chip blue \${alertRadius===200?'on':''}" data-r="200">📡 200m</button>
          <button class="sm-chip blue \${alertRadius===500?'on':''}" data-r="500">📡 500m</button>
        </div>
      </div>
      <div>
        <div class="sr-label" style="margin-bottom:8px">Khung giờ cảnh báo</div>
        <div class="chip-group">
          <button class="sm-chip \${alertTimeWindows.has('morning')?'on':''}" data-tw="morning">🌅 7–9h</button>
          <button class="sm-chip \${alertTimeWindows.has('lunch')?'on':''}" data-tw="lunch">☀️ 11–13h</button>
          <button class="sm-chip \${alertTimeWindows.has('dinner')?'on':''}" data-tw="dinner">🌆 17–19h</button>
          <button class="sm-chip \${alertTimeWindows.has('allday')?'on':''}" data-tw="allday">🕐 Cả ngày</button>
        </div>
      </div>
    </div>
    <div class="alerts-history-col">
      <div class="alerts-history-title">Ghi chú</div>
      <div class="alert-hist-item"><div class="ahi-icon grab">📡</div><div class="ahi-info"><div class="ahi-title">Dữ liệu thực từ Firebase</div><div class="ahi-sub">Các đơn gần đây đều là đơn thật từ người dùng thật trong bán kính của bạn.</div></div></div>
      <div class="alert-hist-item"><div class="ahi-icon shopee">📍</div><div class="ahi-info"><div class="ahi-title">Vị trí GPS</div><div class="ahi-sub">Cấp quyền vị trí để tìm đơn gom chính xác. Vị trí không được lưu lên server.</div></div></div>
    </div>\`;`;

// Find segment from function renderAlertsTab to the end of innerHTML assignment and replace it
const startAlertsIdx = normalized.indexOf(`function renderAlertsTab(body) {`);
const endAlertsIdx = normalized.indexOf(`body.querySelector('#alertToggle').onchange`);

if (startAlertsIdx !== -1 && endAlertsIdx !== -1) {
  const originalAlertsSection = normalized.substring(startAlertsIdx, endAlertsIdx);
  normalized = normalized.replace(originalAlertsSection, alertsNewBody + '\n  ');
  console.log('Successfully patched renderAlertsTab.');
} else {
  console.log('Error: Could not locate renderAlertsTab boundaries.');
}


// 3. Wrap Profile page elements in profile-left-col and profile-right-col
const startProfileIdx = normalized.indexOf(`function renderProfileTab(body) {`);
const endProfileIdx = normalized.indexOf(`body.querySelectorAll('.circle-item-row').forEach`);

if (startProfileIdx !== -1 && endProfileIdx !== -1) {
  const originalProfileSection = normalized.substring(startProfileIdx, endProfileIdx);
  
  const newProfileBody = `function renderProfileTab(body) {
  body.className = 'profile-body';
  const u      = currentUser;
  const prof   = userProfile;
  const circle = curCircle();
  body.innerHTML = \`
    <div class="profile-left-col">
      <div class="profile-hero">
        <div class="prof-av-wrap">
          <img class="prof-av" src="\${u?.photoURL||''}" onerror="this.style.display='none'" alt="">
          <div class="prof-provider-badge google"><svg width="12" height="12" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg></div>
        </div>
        <div class="prof-name">\${u?.displayName||''}</div>
        <div class="prof-email">\${u?.email||''}</div>
      </div>
      <div class="prof-stats" style="margin-top:14px">
        <div class="ps-col"><div class="ps-num">\${prof?.stats?.ordersJoined||0}</div><div class="ps-lbl">Đơn đã gom</div></div>
        <div class="ps-col"><div class="ps-num">\${prof?.stats?.savedTotal>=1000?Math.round((prof.stats.savedTotal||0)/1000)+'k':vnd(prof?.stats?.savedTotal||0)}</div><div class="ps-lbl">Tiết kiệm</div></div>
        <div class="ps-col"><div class="ps-num">\${myCircles.length}</div><div class="ps-lbl">Nhóm</div></div>
      </div>
    </div>
    <div class="profile-right-col">
      <div class="prof-section" style="padding-top:14px">
        <div class="section-label">Nhóm của tôi</div>
        \${myCircles.map(c=>\`
          <div class="circle-item-row \${c.id===currentCircleId?'active':''}" data-cid="\${c.id}">
            <div class="cir-icon">🏢</div>
            <div class="cir-info"><div class="cir-name">\${c.name}</div><div class="cir-loc">\${c.location||''}</div></div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
              \${c.id===currentCircleId?'<span style="font-size:9px;color:var(--grab);font-weight:700">✓ Đang chọn</span>':''}
              \${c.inviteCode?'<span class="code-copy" data-code="'+c.inviteCode+'" style="font-size:9px;color:var(--acc);font-weight:800;cursor:pointer;letter-spacing:1px">📋 '+c.inviteCode+'</span>':''}
            </div>
          </div>\`).join('')}
        <button class="add-circle-btn" id="addCircleBtn">＋ &nbsp;Tham gia hoặc tạo nhóm mới</button>
      </div>
      <div class="prof-section">
        <div class="section-label">Tài khoản</div>
        <div class="settings-link-row" id="goSettings">
          <div class="slr-icon" style="background:rgba(59,130,246,.1)">⚙️</div>
          <div><div class="slr-label">Cài đặt</div><div class="slr-sub">Thông báo, bán kính, giao diện</div></div>
          <span class="slr-chev">›</span>
        </div>
        \${circle?\`<div class="settings-link-row" id="shareInviteBtn">
          <div class="slr-icon" style="background:rgba(52,211,153,.1)">🔗</div>
          <div><div class="slr-label">Chia sẻ mã mời nhóm</div><div class="slr-sub">Gửi cho bạn bè để họ tham gia nhóm này</div></div>
          <span class="slr-val">\${circle.inviteCode||''}</span>
        </div>\`:''}
        <div class="settings-link-row" id="shareAppRow">
          <div class="slr-icon" style="background:rgba(255,159,28,.1)">🎁</div>
          <div><div class="slr-label">Chia sẻ ứng dụng</div><div class="slr-sub">Giới thiệu Gom Đơn cho bạn bè</div></div>
          <span class="slr-chev">›</span>
        </div>
      </div>
      <div class="prof-section"><button class="logout-btn" id="logoutBtn">🚪 Đăng xuất</button></div>
    </div>\`;`;
  
  normalized = normalized.replace(originalProfileSection, newProfileBody + '\n  ');
  console.log('Successfully patched renderProfileTab.');
} else {
  console.log('Error: Could not locate renderProfileTab boundaries.');
}

// Save the patched content back, keeping line endings
const finalContent = code.includes('\r\n') ? normalized.replace(/\n/g, '\r\n') : normalized;
fs.writeFileSync('src/main.js', finalContent, 'utf-8');
console.log('Patch complete.');
