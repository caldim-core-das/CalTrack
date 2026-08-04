import fs from 'fs';

const filepath = 'c:/Users/user/Caltrackk/Caltrack/frontend/src/ui/pages/BookingPage.jsx';
const lines = fs.readFileSync(filepath, 'utf8').split('\n');

lines.forEach((line, idx) => {
  // Check if line contains any non-ascii characters except standard currency or bullet
  const matches = line.match(/[^\x00-\x7F]/g);
  if (matches) {
    console.log(`Line ${idx + 1}: ${line.trim()} ---> Matches: ${JSON.stringify(matches)}`);
  }
});
