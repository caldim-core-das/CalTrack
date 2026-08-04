import fs from 'fs';
import path from 'path';

const replacements = {
  "â‚¹": "₹",
  "â”€": "─",
  "âœ…": "✅",
  "â˜€ï¸ ": "☀️",
  "ðŸŒ…": "🌅",
  "ðŸŒ†": "🌆",
  "ðŸ”§": "🔧",
  "ðŸ“ ": "📍",
  "ðŸ“…": "📅",
  "ðŸ•°ï¸ ": "🕒",
  "ðŸ’b": "💰",
  "ðŸ’💳": "💳",
  "ðŸš": "🚗",
  "ðŸ’a": "💡",
  "ðŸ“ž": "📞",
  "âœ": "✔",
  "â­": "⭐",
  "Ã—": "×",
  "ðŸ›¡ï¸ ": "🛡️",
  "ðŸ‘·": "👷",
  "ðŸ“Ž": "📎",
  "â†’": "→",
  "â€”": "—",
  "Â·": "·",
  "4.8â˜…": "4.8★",
  "â€¢": "•",
  "ðŸŽ‰": "🎉",
  "ðŸ’µ": "💵",
  "ðŸ“±": "📱",
  "â€¦": "…",
};

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css') || fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [oldStr, newStr] of Object.entries(replacements)) {
        if (content.includes(oldStr)) {
          content = content.replaceAll(oldStr, newStr);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Cleaned encoding in: ${fullPath}`);
      }
    }
  }
}

const srcDir = 'c:/Users/user/Caltrackk/Caltrack/frontend/src';
walkDir(srcDir);
console.log('Finished scanning and cleaning all frontend/src files!');
