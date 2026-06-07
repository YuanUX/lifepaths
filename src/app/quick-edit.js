// Quick script to update topPos value
const content = require('fs').readFileSync('/App.tsx', 'utf8');
const updated = content.replace(/const topPos = 8;/g, 'const topPos = 16;');
require('fs').writeFileSync('/App.tsx', updated, 'utf8');
