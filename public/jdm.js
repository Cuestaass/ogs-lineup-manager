(() => {
  const container = document.getElementById('jdm-teams');
  const status = document.getElementById('jdm-status');
  const retry = document.getElementById('jdm-retry');
  const alerts = document.getElementById('jdm-alerts');
  if (!container) return;
  if (location.protocol === 'file:') {
    status.textContent = 'Para consultar datos JDM, abre esta aplicación desde un servidor con la API configurada. El organizador funciona sin conexión.';
    container.innerHTML = '<p>Los partidos y clasificaciones requieren conexión con el servidor.</p>';
    return;
  }
  const followed = new Set(JSON.parse(localStorage.getItem('jdm-followed-v1') || '[]'));
  const seen = JSON.parse(localStorage.getItem('jdm-seen-v1') || '{}');
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
    if (!teams.length) { container.innerHTML = '<p class="empty-state">No hay equipos disponibles en esta consulta.</p>'; return; }
    container.innerHTML = teams.map(team => {
      const next = (team.fixtures || []).filter(match => match.scheduled && !['F', 'N'].includes(match.status) && (!dateValue(match.date) || dateValue(match.date) >= new Date(Date.now() - 86400000))).slice(0, 5);
      const own = (team.standings || []).find(row => row.teamCode === team.teamCode);
      let body = '';
      if (team.state === 'ready') {
        body = `<p>${escape(team.sport)} · ${escape(team.group)} · ${escape(team.district)}</p>
          <p><strong>Clasificación:</strong> ${own ? `<span class="standing-position">${escape(own.position)}.º</span> · ${escape(own.points)} puntos · ${escape(own.played)} partidos` : 'Sin datos'}</p>
          <h4>Próximos partidos</h4>${next.length ? `<ul class="fixture-list">${next.map(match => `<li><div class="fixture-date"><strong>${escape(timeText(match.time))}</strong><span>${escape(match.date || 'Fecha pendiente')}</span></div><div><strong>${escape(match.home)} – ${escape(match.away)}</strong><span>${escape(match.venue || 'Campo pendiente')}</span></div></li>`).join('')}</ul>` : '<p>Sin partidos programados.</p>'}
          <details><summary>Ver clasificación completa</summary><div class="table-wrap"><table class="standings-table"><caption class="sr-only">Clasificación de ${escape(team.name)}</caption><thead><tr><th scope="col">Pos.</th><th scope="col">Equipo</th><th scope="col">PJ</th><th scope="col">Pts.</th></tr></thead><tbody>${team.standings.map(row => `<tr ${row.teamCode === team.teamCode ? 'class="own-team"' : ''}><td>${escape(row.position)}</td><th scope="row">${escape(row.team)}</th><td>${escape(row.played)}</td><td>${escape(row.points)}</td></tr>`).join('')}</tbody></table></div></details>`;
      } else if (team.state === 'ambiguous') body = '<p>Hay varios equipos oficiales con este nombre. Es necesario vincular el código y grupo correctos.</p>';
      else if (team.state === 'unavailable') body = `<p>Aún no hay datos de la temporada ${team.season}/${team.season + 1} para este equipo.</p>`;
      else body = '<p>Esperando la primera sincronización con JDM.</p>';
      return `<article class="jdm-card"><div class="section-heading"><h3>${escape(team.name)}</h3><label class="jdm-follow"><input type="checkbox" data-follow="${escape(team.slug)}" ${followed.has(team.slug) ? 'checked' : ''}> Seguir avisos</label></div>${body}${team.checkedAt ? `<small>Consultado: ${escape(new Date(team.checkedAt).toLocaleString('es-ES'))}</small>` : ''}</article>`;
    }).join('');
  }
  async function checkEvents(slug, quiet = false) {
    const response = await fetch(`/api/jdm/events?slug=${encodeURIComponent(slug)}&since=${seen[slug] || 0}`);
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
      const response = await fetch('/api/jdm/teams');
      if (!response.ok) throw Error('No se pudo consultar JDM');
      const teams = await response.json();
      render(teams);
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
    if (event.target.checked) {
      followed.add(slug);
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      await checkEvents(slug, true);
    } else followed.delete(slug);
    localStorage.setItem('jdm-followed-v1', JSON.stringify([...followed]));
  });
  retry.addEventListener('click', update);
  update();
  setInterval(update, 5 * 60 * 1000);
})();
