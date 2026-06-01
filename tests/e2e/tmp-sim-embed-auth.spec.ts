import { test } from '@playwright/test';
import { loginAsSeedProject } from './utils/auth-helpers';

test('simulation embed when authenticated', async ({ page }) => {
  await loginAsSeedProject(page);
  await page.waitForTimeout(1500);

  await page.goto('/simulation-system/battle', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3000);

  const bodyText = await page.locator('body').innerText();
  const html = await page.content();
  const iframeSrcs = await page.locator('iframe').evaluateAll((els) =>
    els.map((e) => ({ src: e.getAttribute('src'), title: e.getAttribute('title') }))
  );
  const hasFallback = bodyText.includes('未启用模拟器') || bodyText.includes('Simulation system');
  const hasFrameClass = html.includes('SimulationSystemEmbed');

  console.log('url', page.url());
  console.log('body_snippet', bodyText.slice(0, 500).replace(/\n/g, ' | '));
  console.log('iframe_count', iframeSrcs.length);
  console.log('iframes', JSON.stringify(iframeSrcs));
  console.log('hasFallbackText', hasFallback);
  console.log('html_has_frame_wrap', html.includes('frame') || html.includes('iframe'));
});
