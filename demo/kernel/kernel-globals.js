// ==========================================
// KERNEL GLOBALS SHIM
// ==========================================
// The vendored kernel (pwa-sync.js / platform.js) is shipped VERBATIM from the
// legacy app, where a few globals are declared by other legacy files (state.js,
// app.js). Two of them are referenced WITHOUT a typeof guard:
//
//   currentDeviceId  - pwa-sync.js pullRecords()/pushRecords(), platform.js
//   _deviceRole      - pwa-sync.js pullDeviceRole()
//
// A bare reference to an undeclared identifier throws ReferenceError, so this
// shim declares them before the kernel loads. The React app assigns
// window.currentDeviceId once the device id is read (see src/data/dataLayer.ts).
// Keeping this separate from the vendored files means the kernel stays
// byte-identical to packages/pwa and the drift check keeps working.
var currentDeviceId = null;
var _deviceRole = 'standard';
window.currentDeviceId = currentDeviceId;
window._deviceRole = _deviceRole;
