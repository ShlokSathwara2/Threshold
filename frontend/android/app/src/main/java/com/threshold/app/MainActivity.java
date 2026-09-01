package com.threshold.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ThresholdUpdate";
    private static final String VERSION_URL =
        "https://raw.githubusercontent.com/ShlokSathwara2/Threshold_APK/main/version.json";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        WebView.setWebContentsDebuggingEnabled(true);
        registerPlugin(BiometricLockPlugin.class);
        registerPlugin(FileBridgePlugin.class);
        registerPlugin(WidgetSyncPlugin.class);
        super.onCreate(savedInstanceState);
        checkForUpdateNative();
    }

    private void checkForUpdateNative() {
        ExecutorService exec = Executors.newSingleThreadExecutor();
        Handler mainHandler = new Handler(Looper.getMainLooper());
        exec.execute(() -> {
            try {
                String installed = getInstalledVersionName();
                JSONObject remote = fetchVersionJson();
                if (remote == null) return;
                String remoteVer = remote.optString("version", "");
                String apkUrl = remote.optString("apkUrl", "");
                if (remoteVer.isEmpty() || apkUrl.isEmpty()) return;
                if (!isVersionNewer(remoteVer, installed)) return;
                String note = remote.optString("note", "");
                mainHandler.post(() -> showUpdateDialog(remoteVer, note, apkUrl));
            } catch (Exception e) {
                Log.e(TAG, "Native update check failed", e);
            }
        });
    }

    private String getInstalledVersionName() {
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            return pi.versionName != null ? pi.versionName : "0.0.0";
        } catch (PackageManager.NameNotFoundException e) {
            return "0.0.0";
        }
    }

    private JSONObject fetchVersionJson() {
        try {
            URL url = new URL(VERSION_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestMethod("GET");
            if (conn.getResponseCode() != 200) return null;
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            reader.close();
            return new JSONObject(sb.toString());
        } catch (Exception e) {
            Log.e(TAG, "Failed to fetch version.json", e);
            return null;
        }
    }

    private boolean isVersionNewer(String remote, String local) {
        String[] r = remote.split("\\.");
        String[] l = local.split("\\.");
        int len = Math.max(r.length, l.length);
        for (int i = 0; i < len; i++) {
            int ri = i < r.length ? Integer.parseInt(r[i]) : 0;
            int li = i < l.length ? Integer.parseInt(l[i]) : 0;
            if (ri > li) return true;
            if (ri < li) return false;
        }
        return false;
    }

    private void showUpdateDialog(String version, String note, String apkUrl) {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER_HORIZONTAL);
        container.setPadding(dp(28), dp(24), dp(28), dp(20));

        TextView title = new TextView(this);
        title.setText("Update available");
        title.setTextSize(18);
        title.setTextColor(Color.WHITE);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        container.addView(title);

        TextView msg = new TextView(this);
        String body = "Version " + version + " is available.";
        if (!note.isEmpty()) body += "\n\n" + note;
        msg.setText(body);
        msg.setTextSize(14);
        msg.setTextColor(Color.parseColor("#B0B0C0"));
        msg.setLineSpacing(0, 1.3f);
        LinearLayout.LayoutParams msgLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        msgLp.topMargin = dp(10);
        msgLp.bottomMargin = dp(18);
        msg.setLayoutParams(msgLp);
        container.addView(msg);

        Button updateBtn = new Button(this);
        updateBtn.setText("Download Update");
        updateBtn.setTextColor(Color.WHITE);
        updateBtn.setTextSize(15);
        updateBtn.setBackgroundColor(Color.parseColor("#8B5CF6"));
        updateBtn.setPadding(dp(0), dp(12), dp(0), dp(12));
        updateBtn.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl));
            startActivity(intent);
            finish();
        });
        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btnLp.bottomMargin = dp(10);
        updateBtn.setLayoutParams(btnLp);
        container.addView(updateBtn);

        TextView exitText = new TextView(this);
        exitText.setText("Exit");
        exitText.setTextSize(13);
        exitText.setTextColor(Color.parseColor("#808090"));
        exitText.setGravity(Gravity.CENTER);
        exitText.setPadding(dp(0), dp(6), dp(0), dp(6));
        exitText.setOnClickListener(v -> finish());
        container.addView(exitText);

        AlertDialog dialog = new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog)
            .setView(container)
            .setCancelable(false)
            .create();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#0D0E1A")));
        }
        dialog.show();
    }

    private int dp(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density + 0.5f);
    }
}