import { test } from '@playwright/test';

test('simulation embed iframe count', async ({ page }) => {
  const simRequests: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes(':3001')) simRequests.push(url);
  });

  const start = Date.now();
  await page.goto('http://localhost:3000/simulation-system/battle', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const iframeSrcs = await page.locator('iframe').evaluateAll((els) =>
    els.map((e) => ({ src: e.getAttribute('src'), title: e.getAttribute('title') }))
  );

  console.log('elapsed_ms', Date.now() - start);
  console.log('iframe_count', iframeSrcs.length);
  console.log('iframes', JSON.stringify(iframeSrcs, null, 2));
  console.log('sim_requests', simRequests.length);
  console.log('unique_sim', [...new Set(simRequests)].slice(0, 20));
});
