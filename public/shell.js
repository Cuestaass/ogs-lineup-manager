const page = document.body.dataset.page;
const items = [
  { key: 'organizador', href: '../organizador/index.html', label: 'La pizarra', icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 12h18M8 8l2 2m4 4 2 2"/>' },
  { key: 'tactica', href: '../tactica/index.html', label: 'Pizarra táctica', icon: '<path d="M4 4h16v16H4zM12 4v16"/><circle cx="12" cy="12" r="3"/><path d="M7 8l2 2m6 4 2 2"/>' },
  { key: 'jdm', href: '../jdm/index.html', label: 'Partidos y clasificación', icon: '<path d="M4 19V5m0 0h16v14H4zM8 15l3-3 2 2 3-4"/>' }
];
const icon = markup => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${markup}</svg>`;
const sidebar = document.createElement('aside');
sidebar.className = 'app-sidebar';
sidebar.id = 'app-sidebar';
sidebar.innerHTML = `
  <a class="sidebar-brand" href="../organizador/index.html" aria-label="FC OGS · Inicio"><img src="../assets/fc-ogs-crest.png" alt="" width="62" height="62"><span><strong>FC OGS</strong><small>CUADERNO DE CAMPO</small></span></a>
  <div class="sidebar-divider"></div>
  <p class="sidebar-caption">ESPACIO DE EQUIPO</p>
  <nav class="sidebar-nav" aria-label="Navegación principal">${items.map(item => `<a href="${item.href}" ${item.key === page ? 'aria-current="page"' : ''}>${icon(item.icon)}<span>${item.label}</span></a>`).join('')}</nav>
  <div class="sidebar-footer">FC OGS / Fútbol 7<br>Espacio de equipo</div>`;
document.body.prepend(sidebar);
const toggle = document.createElement('button');
toggle.className = 'sidebar-toggle';
toggle.type = 'button';
toggle.setAttribute('aria-label', 'Abrir menú');
toggle.setAttribute('aria-controls', 'app-sidebar');
toggle.setAttribute('aria-expanded', 'false');
toggle.innerHTML = icon('<path d="M4 7h16M4 12h16M4 17h16"/>');
document.body.prepend(toggle);
const backdrop = document.createElement('button');
backdrop.className = 'sidebar-backdrop';
backdrop.type = 'button';
backdrop.setAttribute('aria-label', 'Cerrar menú');
document.body.append(backdrop);
const skip = document.createElement('a');
skip.className = 'skip-link';
skip.href = '#main-content';
skip.textContent = 'Saltar al contenido';
document.body.prepend(skip);
const mobile = matchMedia('(max-width: 980px)');
const content = [document.querySelector('.app-header'), document.querySelector('main')];
function setMenu(open, restoreFocus = false) {
  document.body.classList.toggle('sidebar-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  sidebar.inert = mobile.matches && !open;
  content.forEach(element => { if (element) element.inert = mobile.matches && open; });
  if (open) sidebar.querySelector('[aria-current]')?.focus();
  else if (restoreFocus) toggle.focus();
}
toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('sidebar-open'), true));
backdrop.addEventListener('click', () => setMenu(false, true));
mobile.addEventListener('change', () => setMenu(false));
document.addEventListener('keydown', event => {
  if (!mobile.matches || !document.body.classList.contains('sidebar-open')) return;
  if (event.key === 'Escape') { setMenu(false, true); return; }
  if (event.key === 'Tab') {
    const links = [toggle, ...sidebar.querySelectorAll('a')];
    const index = links.indexOf(document.activeElement);
    event.preventDefault();
    links[(index + (event.shiftKey ? -1 : 1) + links.length) % links.length].focus();
  }
});
setMenu(false);
