const fs = require('fs');
let css = fs.readFileSync('src/style.css', 'utf-8');

// Remove #stage and #phone wrappers, apply background to body
css = css.replace(/html,body\{[^}]+\}/, `html,body{height:100%;font-family:var(--ff);background:var(--s0);color:var(--t1);overflow-x:hidden;overflow-y:auto;}`);
css = css.replace(/#stage\{[^}]+\}/, `body { background: var(--stage-bg); position: relative; }`);
css = css.replace(/#stage::before\{[^}]+\}/, `body::before { content:''; position:fixed; inset:0; z-index:-1; pointer-events:none; background-image:\n  radial-gradient(1.5px 1.5px at 15% 20%,var(--stage-star),transparent),\n  radial-gradient(1px 1px at 75% 15%,var(--stage-star),transparent),\n  radial-gradient(1.5px 1.5px at 40% 70%,var(--stage-star),transparent),\n  radial-gradient(1px 1px at 90% 50%,var(--stage-star),transparent),\n  radial-gradient(1px 1px at 25% 85%,var(--stage-star),transparent),\n  radial-gradient(1.5px 1.5px at 60% 40%,var(--stage-star),transparent); }`);

// Remove phone CSS
css = css.replace(/#phone\{[^}]+\}/g, '');
css = css.replace(/#phone::before\{[^}]+\}/g, '');
css = css.replace(/\.ph-notch\{[^}]+\}/g, '');
css = css.replace(/\.ph-vol\{[^}]+\}/g, '');
css = css.replace(/\.ph-pwr\{[^}]+\}/g, '');

// Update #screen to be the main app container on desktop, full width on mobile
css = css.replace(/#screen\{[^}]+\}/, `#screen { width: 100%; max-width: 480px; margin: 0 auto; min-height: 100vh; background: var(--screen-bg); display: flex; flex-direction: column; position: relative; transition: background .35s; box-shadow: 0 0 20px rgba(0,0,0,0.5); }`);

// Remove media queries for small height since we are no longer constrained by the phone wrapper
css = css.replace(/@media\s*\(\s*max-height\s*:\s*750px\s*\)\s*\{[^}]+\}/g, '');

// Add landing page CSS
css += `
/* ── LANDING PAGE ────────────────────────────────────────── */
.landing-container { width: 100%; min-height: 100vh; display: flex; flex-direction: column; }
.landing-header { display: flex; justify-content: space-between; padding: 20px 40px; align-items: center; }
.landing-logo { font-size: 24px; font-weight: 900; color: var(--t1); display: flex; align-items: center; gap: 10px; }
.landing-hero { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
.landing-title { font-size: 48px; font-weight: 900; letter-spacing: -1.5px; margin-bottom: 20px; max-width: 800px; line-height: 1.2; background: linear-gradient(135deg, #fff 0%, #ff9f1c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.landing-subtitle { font-size: 18px; color: var(--t2); max-width: 600px; line-height: 1.6; margin-bottom: 40px; }
.landing-benefits { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px; max-width: 1000px; width: 100%; padding: 40px 20px; }
.benefit-card { background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 20px; padding: 30px; backdrop-filter: blur(10px); display: flex; flex-direction: column; align-items: center; text-align: center; transition: transform 0.3s; }
.benefit-card:hover { transform: translateY(-5px); border-color: rgba(255,159,28,0.5); }
.bc-icon { font-size: 40px; margin-bottom: 20px; width: 80px; height: 80px; border-radius: 20px; background: rgba(255,159,28,0.1); display: flex; align-items: center; justify-content: center; }
.bc-title { font-size: 20px; font-weight: 800; color: var(--t1); margin-bottom: 10px; }
.bc-desc { font-size: 14px; color: var(--t2); line-height: 1.5; }

@media (max-width: 768px) {
  .landing-title { font-size: 36px; }
  .landing-header { padding: 20px; }
}
`;

fs.writeFileSync('src/style.css', css);
console.log('CSS updated successfully.');
