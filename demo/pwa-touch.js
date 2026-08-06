// ==========================================
// PWA Touch Optimizations for iPad
// ==========================================
(function() {
  'use strict';

  // Prevent pull-to-refresh
  document.body.style.overscrollBehavior = 'none';

  // Prevent double-tap zoom globally
  document.addEventListener('touchend', function(e) {
    // Only prevent on elements that are interactive
    const target = e.target;
    if (target.tagName === 'BUTTON' || target.tagName === 'A' ||
        target.classList.contains('btn-toggle') ||
        target.classList.contains('nav-btn') ||
        target.classList.contains('panel-tab') ||
        target.classList.contains('complaint-btn') ||
        target.classList.contains('temp-range-btn') ||
        target.classList.contains('weight-range-btn') ||
        target.classList.contains('bp-range-btn') ||
        target.classList.contains('dx-preset-btn') ||
        target.classList.contains('preset-btn') ||
        target.classList.contains('rx-preset-btn') ||
        target.classList.contains('provider-btn') ||
        target.classList.contains('procedure-btn') ||
        target.classList.contains('referral-btn') ||
        target.classList.contains('pill-btn') ||
        target.classList.contains('pain-btn') ||
        target.classList.contains('lab-btn') ||
        target.classList.contains('record-card') ||
        target.classList.contains('patient-header') ||
        target.closest('.record-card') ||
        target.closest('.patient-header')) {
      // Let the click handler fire but prevent zoom
    }
  }, { passive: true });

  // Handle virtual keyboard: scroll focused input into view
  if ('visualViewport' in window) {
    let focusedElement = null;

    document.addEventListener('focusin', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        focusedElement = e.target;
      }
    });

    document.addEventListener('focusout', function() {
      focusedElement = null;
    });

    window.visualViewport.addEventListener('resize', function() {
      if (focusedElement) {
        // Small delay to let the keyboard animation finish
        setTimeout(function() {
          if (focusedElement) {
            focusedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    });
  }

  // iOS text input: prevent zoom on focus by ensuring 16px font size
  // (handled in CSS, but reinforce here)
  document.addEventListener('focusin', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      const computed = getComputedStyle(e.target);
      const fontSize = parseFloat(computed.fontSize);
      if (fontSize < 16) {
        e.target.style.fontSize = '16px';
      }
    }
  });

  // Improve touch feedback: add active class on touch for buttons
  let activeTouch = null;
  document.addEventListener('touchstart', function(e) {
    const btn = e.target.closest('button, .record-card, .patient-header, .encounter-card');
    if (btn) {
      activeTouch = btn;
      btn.classList.add('touch-active');
    }
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (activeTouch) {
      activeTouch.classList.remove('touch-active');
      activeTouch = null;
    }
  }, { passive: true });

  document.addEventListener('touchcancel', function() {
    if (activeTouch) {
      activeTouch.classList.remove('touch-active');
      activeTouch = null;
    }
  }, { passive: true });

  // Standalone mode detection for PWA
  if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
    document.documentElement.classList.add('pwa-standalone');
    console.log('[pwa-touch] Running in standalone PWA mode');
  }

  // Handle orientation changes
  window.addEventListener('orientationchange', function() {
    // Force a slight delay to let the viewport settle
    setTimeout(function() {
      window.scrollTo(0, 0);
      // Re-render charts if on analytics screen
      if (typeof renderAnalytics === 'function') {
        const analyticsScreen = document.getElementById('screen-analytics');
        if (analyticsScreen && analyticsScreen.classList.contains('active')) {
          renderAnalytics();
        }
      }
    }, 300);
  });

  // ---- Service Worker registration + RELIABLE updates ----
  // The public demo deliberately does NOT register a service worker: it lives on
  // the marketing site, should never be installable as if it were the real app,
  // and must not cache anything on that origin.
  if ('serviceWorker' in navigator && !window.DH_DEMO) {
    // Reload ONCE, only after an explicit "Update now", when the new worker takes
    // control. The old code reloaded BEFORE the new worker activated, landing
    // right back on the stale cache — the reason updates never stuck.
    var _updateRequested = false, _reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (_updateRequested && !_reloading) { _reloading = true; window.location.reload(); }
    });

    window.addEventListener('load', function () {
      var swPath = new URL('sw.js', window.location.href).toString();
      navigator.serviceWorker.register(swPath)
        .then(function (registration) {
          console.log('[pwa] Service Worker registered, scope:', registration.scope);

          function offerUpdate(worker) {
            if (!worker) return;
            showUpdateBar(function () { _updateRequested = true; worker.postMessage({ type: 'SKIP_WAITING' }); });
          }

          // An update downloaded on a previous visit and is waiting.
          if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);

          // An update is found while the app is open.
          registration.addEventListener('updatefound', function () {
            var newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', function () {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(newWorker);
            });
          });

          // Actually look for new versions: on launch, when foregrounded, hourly.
          registration.update();
          document.addEventListener('visibilitychange', function () { if (!document.hidden) registration.update(); });
          setInterval(function () { registration.update(); }, 60 * 60 * 1000);
        })
        .catch(function (error) { console.warn('[pwa] Service Worker registration failed:', error); });
    });
  }

  // Small, non-blocking "update available" bar (replaces the old confirm()).
  function showUpdateBar(onReload) {
    if (document.getElementById('pwaUpdateBar')) return;
    var bar = document.createElement('div');
    bar.id = 'pwaUpdateBar';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9500;background:#1f2937;color:#fff;' +
      'padding:10px 14px;display:flex;align-items:center;gap:12px;font-size:14px;box-shadow:0 -2px 10px rgba(0,0,0,.2);';
    bar.innerHTML = '<span style="flex:1;">A new version is ready.</span>' +
      '<button id="pwaUpdateBtn" style="background:#F68630;color:#fff;border:none;border-radius:6px;padding:7px 16px;font-weight:600;cursor:pointer;">Update now</button>' +
      '<button id="pwaUpdateLater" style="background:transparent;color:#cbd5e1;border:1px solid #4b5563;border-radius:6px;padding:7px 12px;cursor:pointer;">Later</button>';
    document.body.appendChild(bar);
    document.getElementById('pwaUpdateBtn').addEventListener('click', function () {
      document.getElementById('pwaUpdateBtn').textContent = 'Updating…'; onReload();
    });
    document.getElementById('pwaUpdateLater').addEventListener('click', function () { bar.remove(); });
  }

  // Show which build is running (stamped by build.js) so we never have to guess
  // whether the latest code is live. Subtle label next to the title.
  function showVersion() {
    var v = (typeof window.APP_BUILD === 'string' && window.APP_BUILD.indexOf('__') === -1) ? window.APP_BUILD : 'dev';
    var title = document.querySelector('.topbar-title');
    if (title && !document.getElementById('appVersionLabel')) {
      var s = document.createElement('span');
      s.id = 'appVersionLabel';
      s.textContent = 'v' + v;
      s.title = 'App build version';
      s.style.cssText = 'font-size:10px;color:#9ca3af;font-weight:400;margin-left:8px;white-space:nowrap;';
      title.insertAdjacentElement('afterend', s);
    }
  }
  if (document.readyState !== 'loading') showVersion();
  else document.addEventListener('DOMContentLoaded', showVersion);

  console.log('[pwa-touch] Touch optimizations loaded');
})();
