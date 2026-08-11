// ==========================================
// NATIVE STORAGE — durable, OS-protected storage for the Capacitor app
// ==========================================
// THE reliability fix. In a native (iOS/Android) build, patient records must
// NOT live in web storage (IndexedDB/localStorage), which the OS is allowed to
// evict — that is what made offline records vanish on reopen. This routes the
// records blob to the native FILESYSTEM (app-private Data dir) and other keys
// to native Preferences. Both are real app data: they survive restarts and are
// never evicted like website data.
//
// On the plain web/PWA build this file is inert (window.Capacitor is absent),
// so the app keeps using IndexedDB + localStorage exactly as before.

(function () {
  function isNative() {
    return !!(window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform());
  }
  window.__isNativeApp = isNative;
  if (!isNative()) return;

  // Resolve a plugin without needing a bundler/import: prefer the bridged
  // Plugins map, fall back to registerPlugin() which builds a proxy.
  function getPlugin(name) {
    try {
      if (window.Capacitor.Plugins && window.Capacitor.Plugins[name]) return window.Capacitor.Plugins[name];
      if (typeof window.Capacitor.registerPlugin === 'function') return window.Capacitor.registerPlugin(name);
    } catch (e) {}
    return null;
  }
  var Prefs = getPlugin('Preferences');
  var FS = getPlugin('Filesystem');
  var DIRECTORY = 'DATA';        // app-private, persistent, not synced to iCloud
  var BIG_KEY = /records/i;      // the records blob → filesystem (can grow large)

  function fileFor(key) { return 'dhemr-' + String(key).replace(/[^a-zA-Z0-9_-]/g, '_') + '.json'; }

  async function fsRead(name) {
    try {
      var r = await FS.readFile({ path: name, directory: DIRECTORY, encoding: 'utf8' });
      return (r && r.data != null) ? r.data : null;
    } catch (e) { return null; } // ENOENT on first run
  }
  async function fsWrite(name, str) {
    await FS.writeFile({ path: name, directory: DIRECTORY, encoding: 'utf8', data: str, recursive: true });
  }
  async function fsDelete(name) {
    try { await FS.deleteFile({ path: name, directory: DIRECTORY }); } catch (e) {}
  }

  var NativeKV = {
    async getItem(key) {
      if (FS && BIG_KEY.test(key)) {
        var raw = await fsRead(fileFor(key));
        if (raw == null) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
      }
      if (!Prefs) return null;
      var res = await Prefs.get({ key: key });
      var value = res ? res.value : null;
      if (value == null) return null;
      try { return JSON.parse(value); } catch (e) { return value; }
    },
    async setItem(key, value) {
      var str = (typeof value === 'string') ? value : JSON.stringify(value);
      if (FS && BIG_KEY.test(key)) { await fsWrite(fileFor(key), str); return; }
      if (Prefs) await Prefs.set({ key: key, value: str });
    },
    async removeItem(key) {
      if (FS && BIG_KEY.test(key)) { await fsDelete(fileFor(key)); return; }
      if (Prefs) await Prefs.remove({ key: key });
    },
    async getAllKeys() {
      try { if (Prefs) { var r = await Prefs.keys(); return (r && r.keys) || []; } } catch (e) {}
      return [];
    },
    // idbStore exposes this; native data is already migrated by definition.
    migrateFromLocalStorage: async function () { return 0; }
  };

  window.NativeKV = NativeKV;
  try {
    console.log('[native-storage] ACTIVE — platform:', window.Capacitor.getPlatform && window.Capacitor.getPlatform(),
      '| records→Filesystem(' + DIRECTORY + ')', FS ? 'ok' : 'MISSING',
      '| config→Preferences', Prefs ? 'ok' : 'MISSING');
  } catch (e) {}
})();
