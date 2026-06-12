import { invalidateRequestCache } from '../../../src/lib/utils/safeRequestCache';

describe('invalidateRequestCache', () => {
  it('is a no-op when window is undefined (server)', async () => {
    const originalWindow = global.window;
    // @ts-expect-error simulate server environment
    delete global.window;
    await expect(invalidateRequestCache('field-definitions:test')).resolves.toBeUndefined();
    global.window = originalWindow;
  });
});
