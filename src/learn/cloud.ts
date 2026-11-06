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
import { exportData, replaceAll, parseBackup, subscribe as subscribeStore, type Backup } from './store';
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
// ponytail: Firestore giữ lời hứa treo vô hạn khi không nối được backend (ghi offline xếp hàng chờ mãi) → chấm vàng
// "đang đồng bộ" vĩnh viễn, không thấy lỗi. 20 s đủ cho mạng chậm; quá hạn → đỏ kèm thông báo, lần ghi sau tự thử lại.
const withTimeout = <T>(p: Promise<T>, what: string, ms = 20000) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${what}: timeout ${ms / 1000}s`)), ms))]);

function stopSync() {
  unsubSnap?.(); unsubStore?.(); if (timer) clearTimeout(timer);
  unsubSnap = unsubStore = timer = null;
}

async function push(uid: string, data: Backup) {
  set({ status: 'syncing' });
  try {
    lastRev = newRev();
    const d: CloudDoc = { rev: lastRev, updatedAt: Date.now(), data };
    await withTimeout(setDoc(userDoc(uid), d), 'setDoc');
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
  // LUÔN chuẩn hoá dữ liệu mây (parseBackup) trước khi merge: document do bản cũ ghi không có Word.id → merge
  // theo id gộp mọi từ về một khoá → chỉ còn 1 từ rồi đẩy ngược lên mây (từng xoá sạch sổ từ trên điện thoại).
  // Mọi lỗi (mạng, document hỏng) → trạng thái đỏ kèm thông báo; trước đây exception ngoài try làm kẹt "đang đồng bộ" mãi.
  // Chỉ đẩy exportData() (bản đã chuẩn hoá trong store), không đẩy object merge thô → không gửi undefined/trường lạ.
  let remote: Backup | null = null;
  try {
    const snap = await withTimeout(getDoc(userDoc(uid)), 'getDoc');
    remote = snap.exists() ? parseBackup((snap.data() as CloudDoc).data) : null;
    apply(mergeBackups(exportData(), remote));
    if (sameBackup(exportData(), remote)) set({ status: 'synced' }); else await push(uid, exportData());
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
    return;
  }

  // Thiết bị khác ghi → hợp nhất vào máy này; chỉ ghi lại nếu kết quả khác bản trên mây
  // (so với bản đã chuẩn hoá: không đẩy chỉ vì khác định dạng → không ping-pong với máy chạy bản cũ).
  unsubSnap = onSnapshot(userDoc(uid), (s) => {
    try {
      const d = s.data() as CloudDoc | undefined;
      if (!d || d.rev === lastRev) return;
      const data = parseBackup(d.data);
      apply(mergeBackups(exportData(), data));
      if (!sameBackup(exportData(), data)) void push(uid, exportData());
    } catch (e) { set({ status: 'error', error: (e as Error).message }); }
  }, (e) => set({ status: 'error', error: e.message }));

  // Máy này đổi → đẩy lên sau 1.5 s im lặng.
  unsubStore = subscribeStore(() => {
    if (applying) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void push(uid, exportData()); }, 1500);
  });
}
