import fs from 'fs';

const filepath = 'c:/Users/user/Caltrackk/Caltrack/frontend/src/ui/pages/BookingPage.jsx';
const buffer = fs.readFileSync(filepath);

// Check for BOM
let str = buffer.toString('utf8');
if (str.charCodeAt(0) === 0xFEFF) {
  str = str.slice(1);
}

// Write back as strict UTF-8 without BOM
fs.writeFileSync(filepath, str, { encoding: 'utf8' });
console.log('Converted BookingPage.jsx to strict UTF-8 without BOM!');
