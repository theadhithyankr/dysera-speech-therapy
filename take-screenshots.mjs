import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  await context.addInitScript(() => {
    window.localStorage.setItem('token', 'fake-token');
  });

  const page = await context.newPage();
  
  await page.route('**/api/auth/me', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ full_name: 'Test Patient', role: 'patient', id: 1 })
    });
  });

  await page.route('**/api/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    });
  });

  const routes = [
    '/patient/dashboard',
    '/patient/record',
    '/patient/therapy',
    '/patient/report',
    '/patient/ai-coach',
    '/patient/profile',
    '/patient/settings'
  ];

  for (const route of routes) {
    console.log(`Navigating to ${route}...`);
    await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500); // give time for renders/animations
    const filename = `./public/screenshot-${route.split('/').pop()}.png`;
    await page.screenshot({ path: filename });
    console.log(`Saved ${filename}`);
  }

  await browser.close();
})();
