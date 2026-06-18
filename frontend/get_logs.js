import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR LOG:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.log('PAGE UNCAUGHT ERROR:', error.message);
  });
  
  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.log('Timeout or error:', e.message);
  }
  
  await browser.close();
})();
