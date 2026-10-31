import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isNative = Capacitor.isNativePlatform();

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Lưu file cho người dùng.
 * Android (Capacitor): WebView không hỗ trợ <a download> với blob → ghi vào cache rồi mở bảng Chia sẻ
 * (Lưu vào Files / Drive / Zalo…). Web và Electron-fallback: <a download> như cũ.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  const { uri } = await Filesystem.writeFile({ path: filename, data: await toBase64(blob), directory: Directory.Cache });
  try { await Share.share({ title: filename, files: [uri] }); } catch { /* người dùng đóng bảng chia sẻ */ }
}
