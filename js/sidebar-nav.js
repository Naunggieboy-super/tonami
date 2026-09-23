(() => {
  'use strict';

  const toggleSidebar = () => {
    document.body.classList.toggle('sidebar-open');
  };

  const ensure = () => {
    const menuButton = document.getElementById('mobileMenu');
    const sidenavToggle = document.getElementById('sidebarMenuToggle');
    if (menuButton) menuButton.addEventListener('click', toggleSidebar);
    if (sidenavToggle) sidenavToggle.addEventListener('click', toggleSidebar);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensure, { once: true });
  } else {
    ensure();
  }
})();
