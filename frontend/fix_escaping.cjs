const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/ui/pages/PayrollPage.jsx');
let content = fs.readFileSync(file, 'utf8');

// The file literally has characters \` and \${ and \} which need to be replaced with `, ${, }
content = content.replace(/\\\`/g, '`');
content = content.replace(/\\\$/g, '$');

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully fixed escaping in PayrollPage.jsx');
