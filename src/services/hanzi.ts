import type { CharacterData } from '../types';

// In-memory cache for the parsed dataset
let dataCache: Map<string, CharacterData> | null = null;
let loadingPromise: Promise<Map<string, CharacterData>> | null = null;

/**
 * Loads and parses the Make Me a Hanzi graphics.txt dataset.
 * Results are cached in memory after first load.
 */
async function loadDataset(): Promise<Map<string, CharacterData>> {
  if (dataCache !== null) return dataCache;
  if (loadingPromise !== null) return loadingPromise;

  loadingPromise = (async () => {
    const response = await fetch('/data/graphics.txt');
    if (!response.ok) {
      throw new Error(
        `Không thể tải dữ liệu chữ Hán: ${response.status} ${response.statusText}. ` +
        `Hãy chắc chắn rằng file public/data/graphics.txt tồn tại.`
      );
    }

    const text = await response.text();
    const map = new Map<string, CharacterData>();

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const data = JSON.parse(trimmed) as CharacterData;
        if (data.character && Array.isArray(data.strokes) && Array.isArray(data.medians)) {
          map.set(data.character, data);
        }
      } catch {
        // Skip malformed lines silently
      }
    }

    console.log(`[Hanzi] Đã tải ${map.size} ký tự từ dataset.`);
    dataCache = map;
    return map;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    // Reset so future calls can retry
    loadingPromise = null;
    throw err;
  }
}

/**
 * Returns stroke data for a single Chinese character.
 * Returns null if the character is not in the dataset.
 */
export async function getCharacterData(
  character: string
): Promise<CharacterData | null> {
  const dataset = await loadDataset();
  return dataset.get(character) ?? null;
}

/**
 * Preloads the dataset and returns the total character count.
 */
export async function preloadDataset(): Promise<number> {
  const dataset = await loadDataset();
  return dataset.size;
}

/**
 * Checks whether a character exists in the dataset (without loading full dataset).
 */
export async function hasCharacterData(character: string): Promise<boolean> {
  const dataset = await loadDataset();
  return dataset.has(character);
}

/**
 * Filters a string to only include characters present in the dataset.
 * Returns an array of unique characters in order of appearance.
 */
export async function filterValidCharacters(
  input: string
): Promise<{ valid: string[]; invalid: string[] }> {
  const dataset = await loadDataset();
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const char of input) {
    if (seen.has(char)) continue;
    seen.add(char);

    if (dataset.has(char)) {
      valid.push(char);
    } else {
      invalid.push(char);
    }
  }

  return { valid, invalid };
}
