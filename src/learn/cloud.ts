import { useSyncExternalStore } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithPopup, signInWithCredential, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut as fbSignOut, GoogleAuthProvider, type User,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { firebaseConfig, isFirebaseConfigured } from '../firebase.config';
import { exportData, replaceAll, subscribe as subscribeStore, type Backup } from './store';
import { mergeBackups, sameBackup } from './merge';

// ── Trạng thái cho UI ─────────────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
interface CloudState { user: User | null; status: SyncStatus; error: string; ready: boolean }
let state: CloudState = { user: null, status: 'idle', error: '', ready: !isFirebaseConfigured };
const subs = new Set<() => void>();
const set = (p: Partial<CloudState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const useCloud = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => state);

/** Popup Google cần http(s); bản Electron đóng gói chạy app:// → chỉ còn email/mật khẩu. Android dùng plugin native. */
export const canGoogle = () => Capacitor.isNativePlatform() || /^https?:$/.test(location.protocol);

// ── Khởi tạo lười (chỉ khi đã có config) ─────────────────────────────────────
const app = () => (getApps().length ? getApp() : initializeApp(firebaseConfig));
const auth = () => getAuth(app());
const db = () => getFirestore(app());
const userDoc = (uid: string) => doc(db(), 'users', uid);

let started = false;
export function startCloud() {
  if (started || !isFirebaseConfigured) return;
  started = true;
  onAuthStateChanged(auth(), (user) => {
    stopSync();
    set({ user, ready: true, status: 'idle', error: '' });
    if (user) void startSync(user.uid);
  });
}

// ── Đăng nhập / đăng xuất ────────────────────────────────────────────────────
export async function signInGoogle() {
  if (Capacitor.isNativePlatform()) {
    const r = await FirebaseAuthentication.signInWithGoogle();
    const idToken = r.credential?.idToken;
    if (!idToken) throw new Error('auth/no-id-token');
    await signInWithCredential(auth(), GoogleAuthProvider.credential(idToken));
  } else {
    await signInWithPopup(auth(), new GoogleAuthProvider());
  }
}
export const signInEmail = (email: string, password: string) => signInWithEmailAndPassword(auth(), email, password);
export const signUpEmail = (email: string, password: string) => createUserWithEmailAndPassword(auth(), email, password);
export async function signOut() {
  if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut().catch(() => {});
  await fbSignOut(auth());
}

// ── Đồng bộ: 1 document /users/{uid} = { rev, updatedAt, data: Backup } ──────
// ponytail: cả sổ từ trong một document (~200 B/từ → ~4.900 từ dưới trần 1 MiB của Firestore).
// Tách thành collection từng từ khi vượt ngưỡng đó.
interface CloudDoc { rev: string; updatedAt: number; data: Backup }
let unsubSnap: Unsubscribe | null = null;
let unsubStore: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastRev = '';
let applying = false;
const newRev = () => Math.random().toString(36).slice(2, 10);

function stopSync() {
  unsubSnap?.(); unsubStore?.(); if (timer) clearTimeout(timer);
  unsubSnap = unsubStore = timer = null;
}

async function push(uid: string, data: Backup) {
  set({ status: 'syncing' });
  try {
    lastRev = newRev();
    const d: CloudDoc = { rev: lastRev, updatedAt: Date.now(), data };
    await setDoc(userDoc(uid), d);
    set({ status: 'synced', error: '' });
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
  }
}

/** Áp dữ liệu hợp nhất vào store mà không kích hoạt push ngược lại. */
function apply(merged: Backup) {
  applying = true;
  try { replaceAll(merged); } finally { applying = false; }
}

async function startSync(uid: string) {
  set({ status: 'syncing' });
  let remote: Backup | null = null;
  try {
    const snap = await getDoc(userDoc(uid));
    remote = snap.exists() ? (snap.data() as CloudDoc).data : null;
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
    return;
  }
  const merged = mergeBackups(exportData(), remote);
  apply(merged);
  if (sameBackup(merged, remote)) set({ status: 'synced' }); else await push(uid, merged);

  // Thiết bị khác ghi → hợp nhất vào máy này; chỉ ghi lại nếu kết quả khác bản trên mây.
  unsubSnap = onSnapshot(userDoc(uid), (s) => {
    const d = s.data() as CloudDoc | undefined;
    if (!d || d.rev === lastRev) return;
    const m = mergeBackups(exportData(), d.data);
    apply(m);
    if (!sameBackup(m, d.data)) void push(uid, m);
  }, (e) => set({ status: 'error', error: e.message }));

  // Máy này đổi → đẩy lên sau 1.5 s im lặng.
  unsubStore = subscribeStore(() => {
    if (applying) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void push(uid, exportData()); }, 1500);
  });
}
