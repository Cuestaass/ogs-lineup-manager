import { createCalendar, fixtureCount, googleCalendarUrl } from './calendar.js';

(() => {
  const container = document.getElementById('jdm-teams');
  const status = document.getElementById('jdm-status');
  const retry = document.getElementById('jdm-retry');
  const alerts = document.getElementById('jdm-alerts');
  const searchForm = document.getElementById('jdm-search');
  const searchQuery = document.getElementById('jdm-search-query');
  const searchLeague = document.getElementById('jdm-search-league');
  const searchDistrict = document.getElementById('jdm-search-district');
  const searchResults = document.getElementById('jdm-search-results');
  const exportCalendar = document.getElementById('jdm-export-calendar');
  if (!container) return;
  if (location.protocol === 'file:') {
    status.textContent = 'Para consultar datos JDM, abre esta aplicación desde un servidor con la API configurada. El organizador funciona sin conexión.';
    container.innerHTML = '<p>Los partidos y clasificaciones requieren conexión con el servidor.</p>';
    return;
  }
  const followed = new Set();
  let currentTeams = [];
  const seen = JSON.parse(localStorage.getItem('jdm-seen-v1') || '{}');
  const request = (url, options = {}) => fetch(`${globalThis.__OGS_API_URL__ || ''}${url}`, {
    ...options,
    headers: { ...options.headers, accept: 'application/json', authorization: `Bearer ${globalThis.__OGS_ACCESS_TOKEN__ || ''}` }
  });
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const dateValue = value => {
    if (!value) return null;
    const match = String(value).match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const timeText = value => /^\d{3,4}$/.test(String(value || '')) ? String(value).padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2') : String(value || 'Hora pendiente');
  function render(teams) {
    if (!teams.length) { container.innerHTML = '<p class="empty-state">Todavía no sigues ningún equipo. Busca uno por su nombre para añadir sus partidos y clasificación.</p>'; return; }
    container.innerHTML = teams.map(team => {
      const next = (team.fixtures || []).filter(match => match.scheduled && !['F', 'N'].includes(match.status) && (!dateValue(match.date) || dateValue(match.date) >= new Date(Date.now() - 86400000))).slice(0, 5);
      const own = (team.standings || []).find(row => row.teamCode === team.teamCode);
      let body = '';
      if (team.state === 'ready') {
        body = `<p>${escape(team.sport)} · ${escape(team.group)} · ${escape(team.district)}</p>
          <p><strong>Clasificación:</strong> ${own ? `<span class="standing-position">${escape(own.position)}.º</span> · ${escape(own.points)} puntos · ${escape(own.played)} partidos` : 'Sin datos'}</p>
          <h4>Próximos partidos</h4>${next.length ? `<ul class="fixture-list">${next.map(match => `<li><div class="fixture-date"><strong>${escape(timeText(match.time))}</strong><span>${escape(match.date || 'Fecha pendiente')}</span></div><div class="fixture-summary"><strong>${escape(match.home)} – ${escape(match.away)}</strong><span>${escape(match.venue || 'Campo pendiente')}</span></div><a class="fixture-calendar-link" href="${escape(googleCalendarUrl(team, match))}" target="_blank" rel="noopener noreferrer" aria-label="Añadir ${escape(match.home)} contra ${escape(match.away)} a Google Calendar">Google Calendar</a></li>`).join('')}</ul>` : '<p>Sin partidos programados.</p>'}
          <details><summary>Ver clasificación completa</summary><div class="table-wrap"><table class="standings-table"><caption class="sr-only">Clasificación de ${escape(team.name)}</caption><thead><tr><th scope="col">Pos.</th><th scope="col">Equipo</th><th scope="col">PJ</th><th scope="col">Pts.</th></tr></thead><tbody>${team.standings.map(row => `<tr ${row.teamCode === team.teamCode ? 'class="own-team"' : ''}><td>${escape(row.position)}</td><th scope="row">${escape(row.team)}</th><td>${escape(row.played)}</td><td>${escape(row.points)}</td></tr>`).join('')}</tbody></table></div></details>`;
      } else if (team.state === 'ambiguous') body = '<p>Hay varios equipos oficiales con este nombre. Es necesario vincular el código y grupo correctos.</p>';
      else if (team.state === 'unavailable') body = `<p>Aún no hay datos de la temporada ${team.season}/${team.season + 1} para este equipo.</p>`;
      else body = '<p>Esperando la primera sincronización con JDM.</p>';
      return `<article class="jdm-card"><div class="section-heading"><h3>${escape(team.name)}</h3><label class="jdm-follow"><input type="checkbox" data-follow="${escape(team.slug)}" ${followed.has(team.slug) ? 'checked' : ''} ${team.managedByTeam ? 'disabled' : ''}> ${team.managedByTeam ? 'Incluido por tu equipo' : 'Seguir avisos'}</label></div>${body}${team.checkedAt ? `<small>Consultado: ${escape(new Date(team.checkedAt).toLocaleString('es-ES'))}</small>` : ''}</article>`;
    }).join('');
  }
  async function checkEvents(slug, quiet = false) {
    const response = await request(`/api/jdm/events?slug=${encodeURIComponent(slug)}&since=${seen[slug] || 0}`);
    if (!response.ok) throw Error('No se pudieron consultar los cambios');
    const events = await response.json();
    if (!events.length) return;
    seen[slug] = events.at(-1).id;
    localStorage.setItem('jdm-seen-v1', JSON.stringify(seen));
    if (quiet) return;
    const latest = events.at(-1);
    const detail = `${latest.after.home} – ${latest.after.away}: ${latest.before.date || 'sin fecha'} ${timeText(latest.before.time)} → ${latest.after.date || 'sin fecha'} ${timeText(latest.after.time)}; ${latest.after.venue || 'campo pendiente'}`;
    const message = `${events.length} cambio${events.length === 1 ? '' : 's'} en ${slug.replaceAll('-', ' ').toUpperCase()}`;
    status.textContent = message;
    alerts.textContent = detail;
    if ('Notification' in window && Notification.permission === 'granted') new Notification('JDM · Cambio de partido', { body: detail, tag: `jdm-${slug}` });
  }
  let updating = false;
  async function update() {
    if (updating) return;
    updating = true;
    container.setAttribute('aria-busy', 'true');
    retry.disabled = true;
    status.textContent = 'Consultando la programación oficial…';
    try {
      const response = await request('/api/jdm/teams');
      if (!response.ok) throw Error('No se pudo consultar JDM');
      const teams = await response.json();
      currentTeams = teams;
      teams.forEach(team => followed.add(team.slug));
      render(teams);
      const calendarMatches = fixtureCount(teams);
      if (exportCalendar) {
        exportCalendar.disabled = calendarMatches === 0;
        exportCalendar.textContent = calendarMatches ? `Exportar calendario (${calendarMatches})` : 'Sin partidos para exportar';
      }
      retry.hidden = true;
      status.textContent = '';
      for (const slug of followed) await checkEvents(slug);
      status.textContent ||= 'Fuente: Ayuntamiento de Madrid · datos abiertos (CC BY 4.0).';
    } catch (error) {
      status.textContent = `${error.message}. Puedes volver a intentarlo; el organizador sigue disponible.`;
      retry.hidden = false;
    } finally {
      updating = false;
      retry.disabled = false;
      container.setAttribute('aria-busy', 'false');
    }
  }
  container.addEventListener('change', async event => {
    const slug = event.target.dataset.follow;
    if (!slug) return;
    if (event.target.checked) return;
    const response = await request(`/api/jdm/follows/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    if (!response.ok) { event.target.checked = true; status.textContent = 'No se pudo dejar de seguir el equipo.'; return; }
    followed.delete(slug);
    await update();
  });
  let foundTeams = [];
  searchForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const query = searchQuery.value.trim();
    const league = searchLeague.value.trim();
    const district = searchDistrict.value.trim();
    if (query.length < 2 && !league && !district) return;
    searchResults.textContent = 'Buscando en la fuente oficial…';
    try {
      const params = new URLSearchParams({ q: query, league, district });
      const response = await request(`/api/jdm/search?${params}`);
      if (!response.ok) throw new Error('No se pudo buscar el equipo');
      foundTeams = await response.json();
      searchResults.innerHTML = foundTeams.length ? foundTeams.map((team, index) => `<article class="jdm-search-result"><div><strong>${escape(team.name)}</strong><span>${escape([team.sport, team.group, team.district].filter(Boolean).join(' · '))}</span></div><button type="button" class="secondary" data-follow-result="${index}" ${followed.has(team.slug) ? 'disabled' : ''}>${followed.has(team.slug) ? 'Siguiendo' : 'Seguir equipo'}</button></article>`).join('') : '<p class="empty-state">No se han encontrado equipos con ese nombre.</p>';
    } catch (error) { searchResults.textContent = error.message; }
  });
  searchResults?.addEventListener('click', async event => {
    const index = event.target.dataset.followResult;
    if (index == null) return;
    const team = foundTeams[Number(index)];
    event.target.disabled = true;
    const response = await request('/api/jdm/follows', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(team) });
    if (!response.ok) { event.target.disabled = false; status.textContent = 'No se pudo seguir el equipo.'; return; }
    followed.add(team.slug);
    event.target.textContent = 'Siguiendo';
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    await update();
  });
  retry.addEventListener('click', update);
  exportCalendar?.addEventListener('click', () => {
    const calendar = createCalendar(currentTeams);
    const file = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'partidos-cuaderno-de-campo.ics';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Calendario descargado. Abre el archivo para añadirlo a tu calendario.';
  });
  update();
  setInterval(update, 5 * 60 * 1000);
})();
