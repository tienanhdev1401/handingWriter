// Tạo file cấu hình riêng từ bản mẫu nếu chưa có (clone mới). Không ghi đè file đã có.
import { copyFileSync, existsSync } from 'node:fs';

const pairs = [
  ['src/firebase.config.example.ts', 'src/firebase.config.ts'],
  ['android/app/google-services.example.json', 'android/app/google-services.json'],
];
for (const [from, to] of pairs) {
  if (!existsSync(to) && existsSync(from)) {
    copyFileSync(from, to);
    console.log(`[ensure-config] created ${to} from example (offline mode until you fill it in)`);
  }
}
