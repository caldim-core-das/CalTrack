import fs from 'fs';

const filepath = 'c:/Users/user/Caltrackk/Caltrack/frontend/src/ui/pages/BookingPage.jsx';
const content = fs.readFileSync(filepath, 'utf8');

// Find CustomerAccountModal definition line
const lines = content.split('\n');
let start = -1;
lines.forEach((l, i) => {
  if (l.includes('function CustomerAccountModal')) {
    start = i;
  }
});

console.log('CustomerAccountModal start line:', start + 1);
if (start !== -1) {
  lines.slice(start, start + 350).forEach((l, idx) => {
    if (l.includes('icon:') || l.includes('icon') || l.includes('case') || l.includes('<div') || l.includes('<span')) {
      console.log(`${start + idx + 1}: ${l}`);
    }
  });
}
