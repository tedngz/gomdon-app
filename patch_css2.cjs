const fs = require('fs');
let css = fs.readFileSync('src/style.css', 'utf-8');

// Replace the hardcoded #screen max-width with a class-based approach
css = css.replace(/#screen\s*\{[^}]+\}/, `
#screen { width: 100%; min-height: 100vh; background: var(--screen-bg); display: flex; flex-direction: column; position: relative; transition: background .35s; }
#screen.is-app { max-width: 480px; margin: 0 auto; box-shadow: 0 0 40px rgba(0,0,0,0.3); border-left: 1px solid var(--border); border-right: 1px solid var(--border); background: var(--screen-bg); }
`);

fs.writeFileSync('src/style.css', css);
console.log('CSS updated for responsive app container');
