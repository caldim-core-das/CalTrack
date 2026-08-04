import fs from 'fs';

const filepath = 'c:/Users/user/Caltrackk/Caltrack/frontend/src/ui/pages/BookingPage.jsx';
let content = fs.readFileSync(filepath, 'utf8');

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
  "â€¢": "•"
};

for (const [oldStr, newStr] of Object.entries(replacements)) {
  content = content.replaceAll(oldStr, newStr);
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('Complete encoding clean-up finished!');
