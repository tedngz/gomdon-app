const fs = require('fs');
let code = fs.readFileSync('src/main.js', 'utf-8');

const startIdx = code.indexOf('function renderAuth() {');
const nextFuncIdx = code.indexOf('function renderOnboarding() {');

if (startIdx !== -1 && nextFuncIdx !== -1) {
  // Find the end of renderAuth by looking backwards from nextFuncIdx for '}'
  const endIdx = code.lastIndexOf('}', nextFuncIdx);
  if (endIdx !== -1) {
    const originalFunc = code.substring(startIdx, endIdx + 1);
    
    const newRenderAuth = `function renderAuth() {
  const scr = document.getElementById('screen');
  scr.innerHTML = \`
  <div class="landing-container">
    <div class="landing-header">
      <div class="landing-logo">🍜 Gom Đơn</div>
      <button class="auth-theme-btn" id="authThemeBtn">\${themeIcon()}</button>
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
  </div>\`;
  document.getElementById('btnGoogle').onclick = signInGoogle;
  document.getElementById('authThemeBtn').onclick = toggleTheme;
}`;

    code = code.replace(originalFunc, newRenderAuth);
    fs.writeFileSync('src/main.js', code);
    console.log('Successfully patched renderAuth.');
  } else {
    console.log('Could not find end of renderAuth');
  }
} else {
  console.log('Could not find renderAuth or next function');
}
