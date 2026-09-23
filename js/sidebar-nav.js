(() => {
  'use strict';

  const mobileMenu = document.getElementById('mobileMenu');
  const sidebarToggle = document.getElementById('sidebarMenuToggle');
  const sidebar = document.getElementById('sidebar');
  if (!mobileMenu || !sidebar) return;

  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
  const setOpen = (open) => {
    document.body.classList.toggle('sidebar-open', open);
    mobileMenu.setAttribute('aria-expanded', String(open));
    mobileMenu.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    sidebar.setAttribute('aria-hidden', String(!open));
    if (sidebarToggle) {
      sidebarToggle.setAttribute('aria-expanded', String(open));
      sidebarToggle.setAttribute('aria-label', open ? 'Hide navigation menu' : 'Show navigation menu');
      const label = sidebarToggle.querySelector('[data-menu-label], span:last-child');
      if (label) label.textContent = open ? 'Hide menu' : 'Show menu';
    }
  };

  // Capture the click before app.js' legacy handlers so the button toggles exactly once.
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('#mobileMenu, #sidebarMenuToggle');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setOpen(!document.body.classList.contains('sidebar-open'));
  }, true);

  sidebar.addEventListener('click', (event) => {
    if (isMobile() && event.target.closest('.nav-item')) setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!isMobile() || !document.body.classList.contains('sidebar-open')) return;
    if (!sidebar.contains(event.target) && !mobileMenu.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) setOpen(false);
  }, { passive: true });

  setOpen(false);
})();
