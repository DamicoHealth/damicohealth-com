// ==========================================
// KERNEL EXPOSE SHIM  (loads AFTER the kernel)
// ==========================================
// idb-storage.js and pwa-sync.js declare their singletons as
//   const idbStore = (function(){...})();
//   const pwaSync  = (function(){...})();
// A top-level `const` in a classic script creates a binding in the global
// LEXICAL environment, which is NOT a property of window. The legacy app only
// ever referenced them as bare identifiers, so it never noticed - but ES modules
// (the React bundle) cannot rely on that, and window.pwaSync would be undefined.
//
// This shim republishes them on window so the typed facades have one stable way
// to reach the kernel. Kept separate from the vendored files so those stay
// byte-identical to packages/pwa and the drift check keeps working.
try { if (typeof pwaSync !== 'undefined') window.pwaSync = pwaSync; } catch (e) {}
try { if (typeof idbStore !== 'undefined') window.idbStore = idbStore; } catch (e) {}
// platform.js already assigns window.platform / window.platformRecords itself.
