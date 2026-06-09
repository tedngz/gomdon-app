const fs = require('fs');
let content = fs.readFileSync('src/main.js', 'utf-8');

// Normalize line endings to LF for checking/replacement
const normalized = content.replace(/\r\n/g, '\n');

const target = `async function signInGoogle() {
  const btn = document.getElementById('btnGoogle');
  if (btn) { btn.disabled=true; btn.querySelector('.ab-text').textContent='Đang mở Google…'; }
  try {
    await auth.signInWithPopup(googleProvider);
  } catch(err) {
    if (btn) { btn.disabled=false; btn.querySelector('.ab-text').textContent='Đăng nhập với Google'; }
    if (err.code === 'auth/popup-blocked') toast('⚠️ Popup bị chặn. Hãy cho phép popup trong trình duyệt rồi thử lại.');
    else if (err.code !== 'auth/popup-closed-by-user') toast('❌ '+err.message);
  }
}`;

const replacement = `async function signInGoogle() {
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
}`;

if (normalized.includes(target)) {
  const updated = normalized.replace(target, replacement);
  // Revert back to original CRLF line endings if original file used them
  const finalContent = content.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
  fs.writeFileSync('src/main.js', finalContent, 'utf-8');
  console.log('Successfully patched signInGoogle inside src/main.js');
} else {
  console.log('Error: Could not find target signInGoogle function in src/main.js');
}
