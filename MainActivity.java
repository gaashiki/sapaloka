package com.sapaloka.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.Manifest;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final int PICK = 1;
    private WebView web;
    private ValueCallback<Uri[]> pending;
    private MediaRecorder recorder;
    private File audio;

    /* Dipanggil dari halaman aplikasi untuk pesan suara. */
    public class Bridge {
        @JavascriptInterface
        public String startRec() {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[] {Manifest.permission.RECORD_AUDIO}, 2);
                    }
                });
                return "izin";
            }
            return begin() ? "ok" : "gagal";
        }

        @JavascriptInterface
        public String stopRec() {
            return end();
        }
    }

    private synchronized boolean begin() {
        end();
        try {
            audio = new File(getCacheDir(), "vn.m4a");
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(22050);
            recorder.setAudioEncodingBitRate(32000);
            recorder.setMaxDuration(121000);
            recorder.setOutputFile(audio.getPath());
            recorder.prepare();
            recorder.start();
            return true;
        } catch (IOException e) {
            release();
        } catch (RuntimeException e) {
            release();
        }
        return false;
    }

    private synchronized String end() {
        if (recorder == null) return "";
        try {
            recorder.stop();
            byte[] data = new byte[(int) audio.length()];
            DataInputStream in = new DataInputStream(new FileInputStream(audio));
            try {
                in.readFully(data);
            } finally {
                in.close();
            }
            return "data:audio/mp4;base64," + Base64.encodeToString(data, Base64.NO_WRAP);
        } catch (IOException e) {
            return "";
        } catch (RuntimeException e) {
            return "";
        } finally {
            release();
        }
    }

    private void release() {
        if (recorder != null) recorder.release();
        recorder = null;
        if (audio != null) audio.delete();
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.cancelRec && window.cancelRec()", null);
        end();
        super.onPause();
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return !url.startsWith("file:///android_asset/");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pending != null) pending.onReceiveValue(null);
                pending = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = p.getAcceptTypes();
                boolean video = types.length > 0 && types[0].startsWith("video");
                i.setType(video ? "video/*" : "image/*");
                try {
                    startActivityForResult(Intent.createChooser(i, video ? "Pilih video" : "Pilih foto"), PICK);
                } catch (ActivityNotFoundException e) {
                    pending = null;
                    return false;
                }
                return true;
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request != PICK || pending == null) return;
        pending.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        pending = null;
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.goBack ? window.goBack() : false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) finish();
            }
        });
    }
    }
