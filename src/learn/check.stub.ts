// Giả lập localStorage để learn.check.ts chạy được bằng Node. Import TRƯỚC store.ts.
const mem = new Map<string, string>();
if (typeof localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
    },
  });
}
