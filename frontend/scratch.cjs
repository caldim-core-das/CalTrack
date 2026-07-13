const fs = require('fs');

let content = fs.readFileSync('src/ui/pages/BookingPage.jsx', 'utf-8');

const images = {
  cleaning: [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1512212621149-107ffe572d2f?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1555529902-52611456ea32?w=150&q=80&fit=crop"
  ],
  plumbing: [
    "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1607472586893-edb57cb3b4e1?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=150&q=80&fit=crop"
  ],
  electrical: [
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1558611848-73f7eb4001a1?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1493119508027-2b584f234d6c?w=150&q=80&fit=crop"
  ],
  hvac: [
    "https://images.unsplash.com/photo-1585834898144-884cfa9e39db?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1621905252507-b35492d04029?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1610486842247-7505ed272fc4?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=150&q=80&fit=crop"
  ],
  carpentry: [
    "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=150&q=80&fit=crop"
  ],
  pest_control: [
    "https://images.unsplash.com/photo-1517825738774-7de9363ef735?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1628102491629-778586284000?w=150&q=80&fit=crop"
  ],
  painting: [
    "https://images.unsplash.com/photo-1562259942-27364e0ee76b?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1584820927500-11b3337a7c5a?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1596162954151-cdcb4c0f70a8?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1502672260266-1c1c9b685161?w=150&q=80&fit=crop"
  ],
  appliance_repair: [
    "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1582735689151-a185eb803362?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=150&q=80&fit=crop"
  ],
  security: [
    "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1496368077930-c1e31b4e5b44?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1558002038-1055907df827?w=150&q=80&fit=crop"
  ],
  general: [
    "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=150&q=80&fit=crop",
    "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=150&q=80&fit=crop"
  ]
};

// Replace package images
for (const cat in images) {
  const imgs = images[cat].map(u => u.replace("w=150", "w=300")); // make them bigger for packages
  
  // Find the category in PACKAGES
  const regex = new RegExp(`(${cat}: \\[\n?)([\\s\\S]*?)(\\s+\\],)`, 'g');
  content = content.replace(regex, (match, p1, p2, p3) => {
    let i = 0;
    // Add image property to packages that don't have it
    const newP2 = p2.replace(/({ id:"[^"]+", name:"[^"]+", price:\d+, priceStr:"[^"]+", duration:"[^"]+", popular:(?:true|false), tag:"[^"]+", )(includes)/g, (m, prefix, includes) => {
      const img = imgs[i % imgs.length];
      i++;
      return `${prefix}image:"${img}", ${includes}`;
    });
    return p1 + newP2 + p3;
  });
}

// Replace relatedServices images
for (const cat in images) {
  const imgs = images[cat];
  
  // Find the category in relatedServicesMap
  const regex = new RegExp(`(${cat}: \\[\n?)([\\s\\S]*?)(\\s+\\],)`, 'g');
  content = content.replace(regex, (match, p1, p2, p3) => {
    let i = 0;
    const newP2 = p2.replace(/img: "[^"]+"/g, (m) => {
      const img = imgs[i % imgs.length];
      i++;
      return `img: "${img}"`;
    });
    return p1 + newP2 + p3;
  });
}

fs.writeFileSync('src/ui/pages/BookingPage.jsx', content);
console.log("Done");
