import fs from 'fs';
import path from 'path';

function scanFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    // Look for corrupted character patterns like ð, â, Ã, ï, ¸
    const matches = l.match(/[ðâÃï¸]/g);
    if (matches) {
      console.log(`${filepath}:${idx + 1}: ${l.trim()}`);
    }
  });
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.jsx') || p.endsWith('.js') || p.endsWith('.css')) scanFile(p);
  }
}

walk('c:/Users/user/Caltrackk/Caltrack/frontend/src');
console.log('Scan complete!');
