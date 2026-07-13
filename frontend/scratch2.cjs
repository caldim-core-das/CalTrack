const fs = require('fs');

let content = fs.readFileSync('src/ui/pages/BookingPage.jsx', 'utf-8');

const images = {
  cleaning: [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=300&q=80&fit=crop"
  ],
  plumbing: [
    "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1607472586893-edb57cb3b4e1?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=300&q=80&fit=crop"
  ],
  electrical: [
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=300&q=80&fit=crop"
  ],
  hvac: [
    "https://images.unsplash.com/photo-1585834898144-884cfa9e39db?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1621905252507-b35492d04029?w=300&q=80&fit=crop"
  ],
  carpentry: [
    "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=300&q=80&fit=crop"
  ],
  pest_control: [
    "https://images.unsplash.com/photo-1517825738774-7de9363ef735?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1628102491629-778586284000?w=300&q=80&fit=crop"
  ],
  painting: [
    "https://images.unsplash.com/photo-1562259942-27364e0ee76b?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1584820927500-11b3337a7c5a?w=300&q=80&fit=crop"
  ],
  appliance_repair: [
    "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1582735689151-a185eb803362?w=300&q=80&fit=crop"
  ],
  security: [
    "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1496368077930-c1e31b4e5b44?w=300&q=80&fit=crop"
  ],
  general: [
    "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=300&q=80&fit=crop",
    "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=300&q=80&fit=crop"
  ]
};

// Fix the missing first package images!
for (const cat in images) {
  const imgs = images[cat];
  
  const regex = new RegExp(`(${cat}: \\[\n?)([\\s\\S]*?)(\\s+\\],)`, 'g');
  content = content.replace(regex, (match, p1, p2, p3) => {
    let i = 0;
    // Note tag:"[^"]*" to allow empty tag for the first package!
    const newP2 = p2.replace(/({ id:"[^"]+", name:"[^"]+", price:\d+, priceStr:"[^"]+", duration:"[^"]+", popular:(?:true|false), tag:"[^"]*", )(includes)/g, (m, prefix, includes) => {
      const img = imgs[i % imgs.length];
      i++;
      return `${prefix}image:"${img}", ${includes}`;
    });
    return p1 + newP2 + p3;
  });
}

fs.writeFileSync('src/ui/pages/BookingPage.jsx', content);
console.log("Done fixing missing images");
