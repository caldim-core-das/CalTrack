import fs from 'fs';

const filepath = 'c:/Users/user/Caltrackk/Caltrack/frontend/src/ui/pages/BookingPage.jsx';
const content = fs.readFileSync(filepath, 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('navItems') || l.includes('tab') || l.includes('onChangeTab')) {
    if (i > 2000 && i < 3400) {
      console.log(`${i + 1}: ${l}`);
    }
  }
});
