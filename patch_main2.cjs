const fs = require('fs');
let code = fs.readFileSync('src/main.js', 'utf-8');

// In renderAuth(), remove the is-app class
code = code.replace(/function renderAuth\(\) \{[\s\S]*?const scr = document\.getElementById\('screen'\);/,
  `function renderAuth() {\n  const scr = document.getElementById('screen');\n  scr.classList.remove('is-app');`
);

// In renderApp(), add the is-app class
code = code.replace(/function renderApp\(\) \{[\s\S]*?const scr\s*=\s*document\.getElementById\('screen'\);/,
  `function renderApp() {\n  if (!currentUser) { renderAuth(); return; }\n  if (currentScreen === 'settings') { renderSettings(document.getElementById('screen')); return; }\n  const circle = curCircle();\n  const scr    = document.getElementById('screen');\n  scr.classList.add('is-app');`
);

// In renderOnboarding(), add the is-app class
code = code.replace(/function renderOnboarding\(\) \{[\s\S]*?const scr = document\.getElementById\('screen'\);/,
  `function renderOnboarding() {\n  const scr = document.getElementById('screen');\n  scr.classList.add('is-app');`
);

fs.writeFileSync('src/main.js', code);
console.log('Successfully patched classes in main.js');
