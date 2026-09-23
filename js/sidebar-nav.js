(() => {
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const menu = document.getElementById('mobileMenu');
  const app = document.querySelector('.app-layout');
  if (!sidebar || !menu || !app) return;

  const setOpen = (open) => {
    app.classList.toggle('sidebar-collapsed', !open);
    sidebar.classList.toggle('sidebar-collapsed', !open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Hide navigation menu' : 'Show navigation menu');
    const toggle = document.getElementById('sidebarMenuToggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('[data-menu-label]')?.replaceChildren(document.createTextNode(open ? 'Hide menu' : 'Show menu'));
    }
  };

  const footer = sidebar.querySelector('.sidebar-footer') || sidebar.appendChild(Object.assign(document.createElement('div'), { className: 'sidebar-footer' }));
  if (!document.getElementById('sidebarMenuToggle')) {
    const toggle = document.createElement('button');
    toggle.id = 'sidebarMenuToggle';
    toggle.type = 'button';
    toggle.className = 'sidebar-menu-toggle';
    toggle.setAttribute('aria-label', 'Show navigation menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span aria-hidden="true">☰</span><span data-menu-label>Show menu</span>';
    footer.prepend(toggle);
    toggle.addEventListener('click', () => setOpen(!app.classList.contains('sidebar-collapsed')));
  }

  menu.addEventListener('click', () => setOpen(app.classList.contains('sidebar-collapsed')));
  sidebar.addEventListener('click', (event) => { if (event.target.closest('.nav-item')) setOpen(false); });
  document.addEventListener('click', (event) => {
    if (window.innerWidth <= 760 && !app.classList.contains('sidebar-collapsed') && !sidebar.contains(event.target) && !menu.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 760) setOpen(false); }, { passive: true });
  setOpen(false);
})();
