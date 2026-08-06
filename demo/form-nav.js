// ==========================================
// FORM NAV — collapsible sections + sticky section jump-bar
// ==========================================
// Tames the long encounter form: every built-in/custom section card becomes
// collapsible (tap its header), a sensible "less-used" set starts collapsed,
// and a sticky chip bar lets the clinician jump to any visible section instead
// of scrolling ~6 screens. Call window.FormNav.refresh() after the form's
// sections are rendered (i.e. after FormSchema.applyFormSchema()).

(function () {
  // Sections start EXPANDED by default (user prefers everything open, like the
  // field-tested version). The sticky jump-bar still helps navigate the long
  // form; any section is one tap to collapse if desired.
  const DEFAULT_COLLAPSED = new Set([]);
  function h(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s); }

  // Delegated header click -> toggle collapse (skip the bespoke collapsible
  // cards Imaging/Surgery, which use their own .collapsible-header toggle).
  function initCollapse(root) {
    if (root._collapseWired) return;
    root._collapseWired = true;
    root.addEventListener('click', (e) => {
      const header = e.target.closest('.encounter-card:not(.collapsible-card) > .card-header');
      if (!header) return;
      header.parentElement.classList.toggle('collapsed');
    });
  }

  function applyDefaultCollapse(root) {
    root.querySelectorAll('.encounter-card[data-section]:not(.collapsible-card)').forEach((card) => {
      if (DEFAULT_COLLAPSED.has(card.dataset.section)) card.classList.add('collapsed');
      else card.classList.remove('collapsed');
    });
  }

  function buildJumpBar(root) {
    let nav = root.querySelector('#sectionJumpBar');
    if (!nav) {
      nav = document.createElement('div');
      nav.id = 'sectionJumpBar';
      nav.className = 'section-jump-bar';
      root.insertBefore(nav, root.firstChild);
    }
    const cards = [...root.querySelectorAll('.encounter-card[data-section]')].filter((c) => c.style.display !== 'none');
    nav.innerHTML = cards.map((c) => {
      const titleEl = c.querySelector('.card-header') || c.querySelector('.collapsible-header span:last-child');
      const title = (titleEl ? titleEl.textContent : '') || c.dataset.section;
      return `<button type="button" class="jump-chip" data-target="${h(c.dataset.section)}">${h(title)}</button>`;
    }).join('');
    nav.querySelectorAll('.jump-chip').forEach((chip) => chip.addEventListener('click', () => {
      const card = root.querySelector(`.encounter-card[data-section="${chip.dataset.target}"]`);
      if (card) { card.classList.remove('collapsed'); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }));
  }

  window.FormNav = {
    refresh(root) {
      root = root || document.getElementById('editModeContent');
      if (!root) return;
      initCollapse(root);
      applyDefaultCollapse(root);
      buildJumpBar(root);
    }
  };
})();
