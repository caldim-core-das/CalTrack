import fs from 'fs';

const filepath = 'c:/Users/user/Caltrackk/Caltrack/frontend/src/ui/pages/BookingPage.jsx';
const content = fs.readFileSync(filepath, 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('Choose Payment Method') || l.includes('Cash on Service') || l.includes('Pay via UPI')) {
    console.log(`${i + 1}: ${l}`);
  }
});
