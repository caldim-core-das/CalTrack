import re

filepath = r"c:\Users\user\Caltrackk\Caltrack\frontend\src\ui\pages\BookingPage.jsx"

with open(filepath, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

# Replacements map for garbled UTF-8 / Windows-1252 strings
replacements = {
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
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Also fix any remaining corrupted double-encoded sequences if any
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Encoding clean-up complete!")
