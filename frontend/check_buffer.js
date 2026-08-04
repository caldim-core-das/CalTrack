import fs from 'fs';

const filepath = 'c:/Users/user/Caltrackk/Caltrack/frontend/src/ui/pages/BookingPage.jsx';
const buffer = fs.readFileSync(filepath);

console.log('Buffer header:', buffer.slice(0, 30));
let content = buffer.toString('utf8');
if (content.includes('\0')) {
  console.log('Detected UTF-16LE, converting...');
  content = buffer.toString('utf16le');
}

// Check for any remaining corrupted string representations
console.log('Sample content includes "Payment":', content.includes('Payment'));
fs.writeFileSync(filepath, content, { encoding: 'utf8' });
console.log('Cleaned file written as pure UTF-8');
