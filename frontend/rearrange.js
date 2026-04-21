const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/ui/pages/TimePage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the start of tp-desktop-layout
const layoutStart = content.indexOf('<div className="tp-desktop-layout">');

// Find tp-main-col and its end
const mainColStart = content.indexOf('<div className="tp-main-col">', layoutStart);
// Find tp-side-col
const sideColStart = content.indexOf('<div className="tp-side-col">', mainColStart);
// End of main col is just before side col
const sideColEnd = content.indexOf('</div>\n      </div>\n    </>', sideColStart) + 6;

const mainColContent = content.substring(mainColStart, sideColStart);
const sideColContent = content.substring(sideColStart, sideColEnd);

// Extract Header and Error from mainColContent
const headerStart = mainColContent.indexOf('{/* Header */}');
const statsRowStart = mainColContent.indexOf('{/* Stats Bar (Horizontal) */}');
const headerContent = mainColContent.substring(headerStart, statsRowStart);

const newMainColContent = '        <div className="tp-main-col">\n          ' + mainColContent.substring(statsRowStart);

const newDesktopLayout = `      <div className="tp-desktop-layout">
        
        ${headerContent}
        ${sideColContent}
${newMainColContent}`;

content = content.substring(0, layoutStart) + newDesktopLayout + content.substring(sideColEnd);

fs.writeFileSync(filePath, content);
console.log("Rearranged perfectly!");
