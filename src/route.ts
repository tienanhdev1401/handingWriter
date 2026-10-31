import { useEffect, useState } from 'react';

/** Điều hướng bằng location.hash: '#/gif' | '#/learn/notes' | '#/learn/cards' | '#/learn/shoot'. */
export function useHash() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return hash;
}
