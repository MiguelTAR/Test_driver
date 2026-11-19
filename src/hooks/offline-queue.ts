import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'offline-queue';

export type QueuedItem = {
  id: string;
  createdAt: number;
  payload: unknown;
};


export type Sender = (items: QueuedItem[]) => Promise<void>;

let queue: QueuedItem[] = [];
let loaded = false;
let flushing = false;

async function load() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    queue = raw ? JSON.parse(raw) : [];
  } catch {
    queue = [];
  }
  loaded = true;
}

async function save() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
  }
}


export async function enqueue(payload: unknown) {
  await load();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    payload,
  });
  await save();
}

 
export async function flush(send: Sender): Promise<boolean> {
  await load();
  if (flushing || queue.length === 0) return true;

  flushing = true;
  const batch = [...queue];
  try {
    await send(batch);

    const sent = new Set(batch.map((item) => item.id));
    queue = queue.filter((item) => !sent.has(item.id));
    await save();
    return true;
  } catch {
    return false;
  } finally {
    flushing = false;
  }
}

export async function pendingCount() {
  await load();
  return queue.length;
}