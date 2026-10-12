package es.sund.pokesurvivor;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.view.Choreographer;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * PokéSurvivor como app: el juego web va dentro de la APK (assets/juego) y se
 * sirve desde https://appassets.androidplatform.net (origen https normal, así
 * localStorage y Firebase funcionan igual que en el navegador).
 *
 * Los botones y sticks del mando de la consola no llegan al WebView: se
 * leen aquí y se mandan al juego como estado completo (G.Pad.nativo, ver
 * js/core/gamepad.js), una vez por fotograma como mucho.
 */
public class MainActivity extends Activity {

    private static final String INICIO = "https://appassets.androidplatform.net/juego/dev.html";

    private WebView web;
    private final Map<String, Boolean> botones = new LinkedHashMap<>();
    private float lx, ly, rx, ry, hatX, hatY;
    private boolean pendiente = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // /juego/<ruta> -> assets/juego/<ruta>
        WebViewAssetLoader.AssetsPathHandler assets = new WebViewAssetLoader.AssetsPathHandler(this);
        WebViewAssetLoader cargador = new WebViewAssetLoader.Builder()
                .addPathHandler("/juego/", ruta -> assets.handle("juego/" + ruta))
                .build();

        web = new WebView(this);
        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setDatabaseEnabled(true);
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(false);
        web.setBackgroundColor(0xFF0A1430);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return cargador.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Enlaces externos (créditos, apoyar...): fuera de la app, al navegador.
                if (!"appassets.androidplatform.net".equals(request.getUrl().getHost())) {
                    try {
                        startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, request.getUrl()));
                    } catch (Exception ignored) {
                        // sin navegador: se ignora
                    }
                    return true;
                }
                return false;
            }
        });
        // Su mera existencia le dice al juego que va dentro de la app (sin service worker).
        web.addJavascriptInterface(new Puente(), "PSNativo");
        setContentView(web);
        pantallaCompleta();
        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(INICIO);
            Actualizador.comprobar(this);
        }
    }

    /** Lo que el juego puede preguntar a la app. */
    static final class Puente {
        @JavascriptInterface
        public String plataforma() {
            return "android";
        }
    }

    private void pantallaCompleta() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            pantallaCompleta();
        }
    }

    // ---------------- mando ----------------

    /** Nombre lógico del botón (el que entiende gamepad.js), o null si no es de mando. */
    private static String boton(int codigo) {
        switch (codigo) {
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_DPAD_CENTER:
                return "a";
            case KeyEvent.KEYCODE_BUTTON_B:
            case KeyEvent.KEYCODE_BACK:
                return "b";
            case KeyEvent.KEYCODE_BUTTON_X: return "x";
            case KeyEvent.KEYCODE_BUTTON_Y: return "y";
            case KeyEvent.KEYCODE_BUTTON_L1: return "l1";
            case KeyEvent.KEYCODE_BUTTON_R1: return "r1";
            case KeyEvent.KEYCODE_BUTTON_L2: return "l2";
            case KeyEvent.KEYCODE_BUTTON_R2: return "r2";
            case KeyEvent.KEYCODE_BUTTON_START: return "start";
            case KeyEvent.KEYCODE_BUTTON_SELECT: return "select";
            case KeyEvent.KEYCODE_BUTTON_THUMBL: return "l3";
            case KeyEvent.KEYCODE_BUTTON_THUMBR: return "r3";
            case KeyEvent.KEYCODE_DPAD_UP: return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "right";
            default: return null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        String b = boton(e.getKeyCode());
        if (b == null) {
            return super.dispatchKeyEvent(e); // teclado físico, volumen...: lo normal
        }
        if (e.getAction() == KeyEvent.ACTION_DOWN) {
            if (e.getRepeatCount() == 0) {
                botones.put(b, true);
                avisar();
            }
        } else if (e.getAction() == KeyEvent.ACTION_UP) {
            botones.remove(b);
            avisar();
        }
        return true; // el WebView no lo ve: nada de scroll ni foco nativo
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        boolean deMando = (e.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                || (e.getSource() & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD;
        if (!deMando || e.getAction() != MotionEvent.ACTION_MOVE) {
            return super.dispatchGenericMotionEvent(e);
        }
        lx = e.getAxisValue(MotionEvent.AXIS_X);
        ly = e.getAxisValue(MotionEvent.AXIS_Y);
        rx = e.getAxisValue(MotionEvent.AXIS_Z);
        ry = e.getAxisValue(MotionEvent.AXIS_RZ);
        // Cruceta como eje (muchas consolas la mandan así en vez de con teclas).
        hatX = e.getAxisValue(MotionEvent.AXIS_HAT_X);
        hatY = e.getAxisValue(MotionEvent.AXIS_HAT_Y);
        // Gatillos analógicos.
        gatillo("l2", Math.max(e.getAxisValue(MotionEvent.AXIS_LTRIGGER), e.getAxisValue(MotionEvent.AXIS_BRAKE)));
        gatillo("r2", Math.max(e.getAxisValue(MotionEvent.AXIS_RTRIGGER), e.getAxisValue(MotionEvent.AXIS_GAS)));
        avisar();
        return true;
    }

    private final Map<String, Boolean> gatillos = new LinkedHashMap<>();

    private void gatillo(String nombre, float valor) {
        if (valor > 0.5f) {
            gatillos.put(nombre, true);
        } else if (valor < 0.3f) {
            gatillos.remove(nombre);
        }
    }

    /** Agrupa los cambios y los manda al juego en el siguiente fotograma. */
    private void avisar() {
        if (pendiente) {
            return;
        }
        pendiente = true;
        Choreographer.getInstance().postFrameCallback(t -> {
            pendiente = false;
            web.evaluateJavascript("window.G&&G.Pad&&G.Pad.nativo(" + estado() + ")", null);
        });
    }

    private String estado() {
        JSONObject o = new JSONObject();
        try {
            JSONObject b = new JSONObject();
            for (String k : botones.keySet()) b.put(k, true);
            for (String k : gatillos.keySet()) b.put(k, true);
            if (hatX < -0.5f) b.put("left", true);
            if (hatX > 0.5f) b.put("right", true);
            if (hatY < -0.5f) b.put("up", true);
            if (hatY > 0.5f) b.put("down", true);
            o.put("btn", b);
            o.put("lx", lx);
            o.put("ly", ly);
            o.put("rx", rx);
            o.put("ry", ry);
        } catch (JSONException ignored) {
            // claves fijas: no pasa
        }
        return o.toString();
    }

    // ---------------- ciclo de vida ----------------

    // ---------------- Wi-Fi ----------------

    /**
     * Sin esto, el ahorro de energía del Wi-Fi de las consolas (Retroid...)
     * corta la conexión unos segundos de vez en cuando. En el cooperativo eso
     * basta para que Firebase dé al jugador por desconectado y lo saque de la
     * sala («La sala se ha cerrado»), aunque el juego siga en pantalla. Mientras
     * la app está delante, el Wi-Fi va en modo baja latencia (como los juegos online).
     */
    private WifiManager.WifiLock wifi;

    @SuppressWarnings("deprecation")
    private void wifiSinAhorro(boolean activar) {
        try {
            if (wifi == null) {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm == null) {
                    return;
                }
                int modo = Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                wifi = wm.createWifiLock(modo, "PokeSurvivor:juego");
                wifi.setReferenceCounted(false);
            }
            if (activar) {
                wifi.acquire();
            } else if (wifi.isHeld()) {
                wifi.release();
            }
        } catch (RuntimeException ignored) {
            // sin Wi-Fi o sin permiso: se juega igual
        }
    }

    @Override
    protected void onPause() {
        wifiSinAhorro(false);
        // Suelta todo: si no, un botón pulsado al salir se queda "pegado".
        botones.clear();
        gatillos.clear();
        lx = ly = rx = ry = hatX = hatY = 0;
        web.evaluateJavascript("window.G&&G.Pad&&G.Pad.nativo(" + estado() + ")", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        wifiSinAhorro(true);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
