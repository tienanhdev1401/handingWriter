package com.hanzi.gifgenerator;

import android.os.Bundle;
import android.view.View;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Quay lại app (sau hộp thoại đăng nhập Google, bảng Chia sẻ…) → ẩn lại thanh hệ thống
        if (hasFocus) hideSystemBars();
    }

    /**
     * Toàn màn hình kiểu immersive: ẩn thanh trạng thái (pin, sóng) và thanh điều hướng.
     * Vuốt từ mép màn hình thì thanh hiện tạm rồi tự ẩn, không chiếm lại chỗ của WebView.
     */
    private void hideSystemBars() {
        View root = getWindow().getDecorView();
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), root);
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}
