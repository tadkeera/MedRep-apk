package com.medrep.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final String APP_FOLDER = "Med Rep";
    private static final int REQ_PERMISSIONS = 1001;
    private static final int REQ_FILE_CHOOSER = 1002;
    // FIXED port => stable WebView origin => localStorage/IndexedDB survive app restarts
    private static final int FIXED_PORT = 17653;
    private static final String AUTO_STATE_FILE = "medrep_auto_state.json";

    private WebView webView;
    private LocalServer server;
    private int serverPort = 0;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestNeededPermissions();
        createAppFolders();

        try {
            server = new LocalServer(getAssets());
            // Fixed port keeps the WebView origin identical across app restarts,
            // so localStorage / IndexedDB data is never lost between sessions.
            serverPort = server.start(FIXED_PORT);
        } catch (IOException e) {
            Toast.makeText(this, "Server error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }

        webView = new WebView(this);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setGeolocationEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(new NativeBridge(), "MedRepNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                injectNativeSync(view);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, REQ_FILE_CHOOSER);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Catch data: URI downloads as a fallback
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (url.startsWith("data:")) {
                try {
                    String name = "medrep_file_" + System.currentTimeMillis();
                    int comma = url.indexOf(',');
                    String meta = url.substring(5, comma);
                    String data = url.substring(comma + 1);
                    byte[] bytes = meta.contains("base64")
                            ? Base64.decode(data, Base64.DEFAULT)
                            : Uri.decode(data).getBytes(StandardCharsets.UTF_8);
                    File out = writeToFolder("download", name, bytes);
                    toast("Saved: " + out.getAbsolutePath());
                } catch (Exception ignored) {}
            }
        });

        setContentView(webView);
        webView.loadUrl("http://127.0.0.1:" + serverPort + "/index.html");
    }

    private void requestNeededPermissions() {
        if (Build.VERSION.SDK_INT >= 23) {
            String[] perms = new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE,
                    Manifest.permission.READ_EXTERNAL_STORAGE
            };
            boolean need = false;
            for (String p : perms) {
                if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) { need = true; break; }
            }
            if (need) requestPermissions(perms, REQ_PERMISSIONS);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_PERMISSIONS) {
            createAppFolders();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE_CHOOSER && filePathCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    /** Create  /Med Rep/backup  and  /Med Rep/download  on install/first run */
    private void createAppFolders() {
        File root = getAppRoot();
        File backup = new File(root, "backup");
        File download = new File(root, "download");
        //noinspection ResultOfMethodCallIgnored
        backup.mkdirs();
        //noinspection ResultOfMethodCallIgnored
        download.mkdirs();
    }

    private File getAppRoot() {
        File primary = new File(Environment.getExternalStorageDirectory(), APP_FOLDER);
        if (primary.exists() || primary.mkdirs()) {
            File probe = new File(primary, ".probe");
            try {
                if (probe.createNewFile() || probe.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    probe.delete();
                    return primary;
                }
            } catch (IOException ignored) {}
        }
        File docs = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), APP_FOLDER);
        if (docs.exists() || docs.mkdirs()) return docs;
        return new File(getExternalFilesDir(null), APP_FOLDER);
    }

    private File writeToFolder(String folder, String name, byte[] bytes) throws IOException {
        File dir = new File(getAppRoot(), folder);
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        File out = new File(dir, sanitize(name));
        try (FileOutputStream fos = new FileOutputStream(out)) {
            fos.write(bytes);
        }
        return out;
    }

    private static String sanitize(String name) {
        return name.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private void toast(final String msg) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
    }

    /**
     * Injected JS:
     *  1. Auto-sync: every 3s reads the app's own virtual file registry (localStorage medrep_db_state)
     *     and writes every BACKUP file to /Med Rep/backup and every DOWNLOAD file to /Med Rep/download.
     *  2. Intercepts every blob: <a download> click (jsPDF .save(), CSV/JSON exports from all pages)
     *     and saves the real binary to /Med Rep/download.
     */
    private void injectNativeSync(WebView view) {
        String js =
            "(function(){" +
            "if(window.__medrepNative)return;window.__medrepNative=true;" +
            "var saved={};" +
            "function b64utf8(s){return btoa(unescape(encodeURIComponent(s)));}" +
            "function sync(){try{" +
            "var raw=localStorage.getItem('medrep_db_state');if(!raw)return;" +
            "var st=JSON.parse(raw);if(!st.files)return;" +
            "st.files.forEach(function(f){" +
            "var key=f.folder+'/'+f.name;" +
            "var sig=(f.content?f.content.length:0)+'|'+(f.dateModified||'');" +
            "if(saved[key]===sig)return;saved[key]=sig;" +
            "var folder=(f.folder==='BACKUP')?'backup':'download';" +
            "try{MedRepNative.saveTextFile(folder,f.name,b64utf8(f.content||''));}catch(e){}" +
            "});}catch(e){}}" +
            "setInterval(sync,3000);setTimeout(sync,1500);" +
            "function capture(a){var href=a.href||'';if(href.indexOf('blob:')!==0)return false;" +
            "var name=a.getAttribute('download')||('medrep_'+Date.now());" +
            "fetch(href).then(function(r){return r.blob();}).then(function(b){" +
            "var fr=new FileReader();fr.onload=function(){" +
            "var b64=String(fr.result).split(',')[1]||'';" +
            "try{MedRepNative.saveBinaryFile('download',name,b64);}catch(e){}};" +
            "fr.readAsDataURL(b);});return true;}" +
            "var oc=HTMLAnchorElement.prototype.click;" +
            "HTMLAnchorElement.prototype.click=function(){" +
            "if(this.hasAttribute&&this.hasAttribute('download')&&capture(this))return;" +
            "return oc.apply(this,arguments);};" +
            "document.addEventListener('click',function(ev){" +
            "var a=ev.target&&ev.target.closest?ev.target.closest('a[download]'):null;" +
            "if(a&&capture(a)){ev.preventDefault();ev.stopPropagation();}},true);" +
            "})();";
        view.evaluateJavascript(js, null);
    }

    /** JS <-> Android bridge */
    private class NativeBridge {

        @JavascriptInterface
        public void saveTextFile(String folder, String name, String base64Utf8) {
            try {
                byte[] bytes = Base64.decode(base64Utf8, Base64.DEFAULT);
                File out = writeToFolder(folder, name, bytes);
                toast(("backup".equals(folder) ? "Backup saved: " : "Saved: ") + out.getAbsolutePath());
            } catch (Exception e) {
                toast("Save failed: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public void saveBinaryFile(String folder, String name, String base64) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                File out = writeToFolder(folder, name, bytes);
                toast("Saved: " + out.getAbsolutePath());
            } catch (Exception e) {
                toast("Save failed: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public String getAppFolderPath() {
            return getAppRoot().getAbsolutePath();
        }

        /**
         * AUTO-PERSIST: called by the web app on every saveState().
         * Writes the full database JSON to:
         *   1) the app's private internal storage (always survives restarts), and
         *   2) a rolling auto-backup inside /Med Rep/backup/.
         */
        @JavascriptInterface
        public void persistState(String base64Utf8Json) {
            try {
                byte[] bytes = Base64.decode(base64Utf8Json, Base64.DEFAULT);
                // 1) Internal private copy (authoritative, no permission needed)
                File internal = new File(getFilesDir(), AUTO_STATE_FILE);
                try (FileOutputStream fos = new FileOutputStream(internal)) {
                    fos.write(bytes);
                }
                // 2) Rolling external auto-backup copy
                try {
                    writeToFolder("backup", "medrep_auto_state.json", bytes);
                } catch (Exception ignored) {}
            } catch (Exception e) {
                // never crash the app because of persistence
            }
        }

        /**
         * AUTO-RESTORE: called by the web app at boot when its own storage is empty.
         * Returns the last persisted database JSON, or "" if none exists.
         */
        @JavascriptInterface
        public String loadPersistedState() {
            try {
                File internal = new File(getFilesDir(), AUTO_STATE_FILE);
                File source = internal.exists() ? internal : new File(new File(getAppRoot(), "backup"), "medrep_auto_state.json");
                if (!source.exists()) return "";
                byte[] buf = new byte[(int) source.length()];
                try (java.io.FileInputStream fis = new java.io.FileInputStream(source)) {
                    int off = 0;
                    while (off < buf.length) {
                        int n = fis.read(buf, off, buf.length - off);
                        if (n < 0) break;
                        off += n;
                    }
                }
                return new String(buf, StandardCharsets.UTF_8);
            } catch (Exception e) {
                return "";
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (server != null) server.stop();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    /** Tiny embedded HTTP server serving the unchanged web build from assets/www (localhost = secure context: geolocation + IndexedDB + localStorage all work). */
    private static class LocalServer implements Runnable {
        private final AssetManager assets;
        private ServerSocket socket;
        private volatile boolean running = true;

        LocalServer(AssetManager assets) { this.assets = assets; }

        int start(int preferredPort) throws IOException {
            socket = new ServerSocket();
            try {
                // Always try the fixed port first => stable origin => persistent web storage
                socket.bind(new InetSocketAddress("127.0.0.1", preferredPort));
            } catch (IOException busy) {
                socket = new ServerSocket();
                socket.bind(new InetSocketAddress("127.0.0.1", 0));
            }
            Thread t = new Thread(this, "MedRepLocalServer");
            t.setDaemon(true);
            t.start();
            return socket.getLocalPort();
        }

        void stop() {
            running = false;
            try { if (socket != null) socket.close(); } catch (IOException ignored) {}
        }

        @Override
        public void run() {
            while (running) {
                try {
                    final Socket client = socket.accept();
                    new Thread(() -> handle(client)).start();
                } catch (IOException e) {
                    if (running) { /* ignore */ }
                }
            }
        }

        private void handle(Socket client) {
            try (Socket c = client) {
                BufferedReader in = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8));
                String line = in.readLine();
                if (line == null) return;
                String[] parts = line.split(" ");
                if (parts.length < 2) return;
                String path = parts[1];
                // drain headers
                String h;
                while ((h = in.readLine()) != null && !h.isEmpty()) { /* skip */ }

                int q = path.indexOf('?');
                if (q >= 0) path = path.substring(0, q);
                if (path.equals("/")) path = "/index.html";
                path = Uri.decode(path);

                OutputStream out = c.getOutputStream();
                InputStream is = null;
                try {
                    is = assets.open("www" + path);
                } catch (IOException e) {
                    // SPA fallback to index.html
                    try { is = assets.open("www/index.html"); path = "/index.html"; } catch (IOException ignored) {}
                }
                if (is == null) {
                    out.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    return;
                }
                byte[] buf = new byte[8192];
                java.io.ByteArrayOutputStream body = new java.io.ByteArrayOutputStream();
                int n;
                while ((n = is.read(buf)) > 0) body.write(buf, 0, n);
                is.close();
                byte[] data = body.toByteArray();

                String head = "HTTP/1.1 200 OK\r\n" +
                        "Content-Type: " + mime(path) + "\r\n" +
                        "Content-Length: " + data.length + "\r\n" +
                        "Cache-Control: no-cache\r\n" +
                        "Access-Control-Allow-Origin: *\r\n" +
                        "Connection: close\r\n\r\n";
                out.write(head.getBytes(StandardCharsets.UTF_8));
                out.write(data);
                out.flush();
            } catch (IOException ignored) {}
        }

        private static String mime(String path) {
            String p = path.toLowerCase();
            if (p.endsWith(".html")) return "text/html; charset=utf-8";
            if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
            if (p.endsWith(".css")) return "text/css; charset=utf-8";
            if (p.endsWith(".json")) return "application/json; charset=utf-8";
            if (p.endsWith(".svg")) return "image/svg+xml";
            if (p.endsWith(".png")) return "image/png";
            if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
            if (p.endsWith(".webp")) return "image/webp";
            if (p.endsWith(".ico")) return "image/x-icon";
            if (p.endsWith(".woff2")) return "font/woff2";
            if (p.endsWith(".woff")) return "font/woff";
            if (p.endsWith(".ttf")) return "font/ttf";
            if (p.endsWith(".map")) return "application/json";
            return "application/octet-stream";
        }
    }
}
