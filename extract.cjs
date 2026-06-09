const fs = require('fs');
const html = fs.readFileSync('index_backup.html', 'utf-8');

const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (cssMatch) {
  fs.writeFileSync('src/style.css', cssMatch[1]);
}

const inlineScriptMatch = html.match(/<script>(?!.*src)([\s\S]*?)<\/script>/);
if (inlineScriptMatch) {
  fs.writeFileSync('src/main.js', `import './style.css';\n\n` + inlineScriptMatch[1]);
}

let newHtml = html.replace(/<style>[\s\S]*?<\/style>/, '');
newHtml = newHtml.replace(/<script>(?!.*src)[\s\S]*?<\/script>/, '<script type="module" src="/src/main.js"></script>');
fs.writeFileSync('index.html', newHtml);
console.log('Extraction complete.');
