import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn(), select: vi.fn(), from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: mock }));
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.clearAllMocks();
  mock.from.mockReturnValue(mock); mock.select.mockReturnValue(mock); mock.eq.mockReturnValue(mock);
  mock.maybeSingle.mockResolvedValue({ data: { data: {}, version: 1 }, error: null });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('cloud persistence', () => {
  it('loads cloud data before allowing access, without browser fallback', async () => {
    const storage = await import('./app-storage');
    expect(() => storage.appStorage.getItem('shopshield_tools')).toThrow('not loaded');
    mock.maybeSingle.mockResolvedValue({ data: { data: { shopshield_tools: '[]' }, version: 7 }, error: null });
    await storage.loadCloudData('owner-a');
    expect(mock.eq).toHaveBeenCalledWith('owner_id', 'owner-a');
    expect(storage.appStorage.getItem('shopshield_tools')).toBe('[]');
  });
  it('saves related collections together with the loaded version', async () => {
    const storage = await import('./app-storage');
    await storage.loadCloudData('owner-a');
    mock.rpc.mockResolvedValue({ data: 2, error: null });
    storage.appStorage.setItem('shopshield_tools', '[]');
    storage.appStorage.setItem('shopshield_bills', '[]');
    await storage.flushCloudData();
    expect(mock.rpc).toHaveBeenCalledWith('save_shop_state', {
      expected_version: 1, next_data: { shopshield_tools: '[]', shopshield_bills: '[]' },
    });
    expect(storage.cloudStatus.get().status).toBe('saved');
  });
  it('keeps failed edits and blocks further saves after a conflict', async () => {
    const storage = await import('./app-storage');
    await storage.loadCloudData('owner-a');
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'Another device updated this shop' } });
    storage.appStorage.setItem('shopshield_tools', '[{"id":"new"}]');
    await expect(storage.flushCloudData()).rejects.toBeTruthy();
    expect(storage.cloudStatus.get().status).toBe('error');
    expect(storage.appStorage.getItem('shopshield_tools')).toContain('new');
    await expect(storage.flushCloudData()).rejects.toThrow('Another device');
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it('does not permit reads or writes after a failed load', async () => {
    const storage = await import('./app-storage');
    mock.maybeSingle.mockResolvedValue({ data: null, error: new Error('network unavailable') });
    await expect(storage.loadCloudData('owner-a')).rejects.toThrow('network unavailable');
    expect(() => storage.appStorage.setItem('shopshield_tools', '[]')).toThrow('not loaded');
  });
  it('does not accept authentication secrets as business collections', async () => {
    const storage = await import('./app-storage');
    await storage.loadCloudData('owner-a');
    expect(() => storage.appStorage.setItem('shopshield_users', '[]')).toThrow('Unsupported');
  });
  it('saves edits made during an in-flight request with the next version', async () => {
    const storage = await import('./app-storage');
    await storage.loadCloudData('owner-a');
    let resolveFirst!: (value: unknown) => void;
    mock.rpc.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: 3, error: null });
    storage.appStorage.setItem('shopshield_tools', '[]');
    const saving = storage.flushCloudData();
    storage.appStorage.setItem('shopshield_customers', '[]');
    resolveFirst({ data: 2, error: null });
    await saving;
    expect(mock.rpc).toHaveBeenNthCalledWith(2, 'save_shop_state', {
      expected_version: 2, next_data: { shopshield_tools: '[]', shopshield_customers: '[]' },
    });
    expect(storage.cloudStatus.get().status).toBe('saved');
  });

});
