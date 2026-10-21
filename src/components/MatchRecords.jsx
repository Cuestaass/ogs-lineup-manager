import React, { useEffect, useState } from 'react';
import { api } from '../auth/supabase.js';
import { hasPermission } from '../../access.js';
import { goalsForMatch } from '../lib/matchStats.js';

async function readJson(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

function GoalForm({ match, roster, base, onRecorded }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    setSaving(true);
    setMessage('Registrando gol…');
    try {
      await readJson(await api(`${base}/goals`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, rosterPlayerId: form.get('rosterPlayerId'), minute: form.get('minute') || null })
      }));
    } catch (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }
    element.reset();
    try {
      await onRecorded();
      setMessage('Gol registrado. Puedes añadir otro.');
    } catch {
      setMessage('Gol registrado. No se pudo actualizar la lista; pulsa Actualizar partidos para verlo.');
    } finally { setSaving(false); }
  }
  return <form className="match-goal-form" aria-label={`Registrar gol en ${match.home} contra ${match.away}`} onSubmit={submit}>
    <fieldset disabled={saving}>
      <legend>Registrar gol</legend>
      <div className="match-goal-fields">
        <label><span>Goleador</span><select name="rosterPlayerId" required defaultValue=""><option value="" disabled>Selecciona jugador</option>{roster.map(player => <option key={player.id} value={player.id}>{player.number ? `${player.number} · ` : ''}{player.display_name}</option>)}</select></label>
        <label><span>Minuto <small>(opcional)</small></span><input name="minute" type="number" min="0" max="200" step="1" placeholder="—"/></label>
        <button className="primary" type="submit">{saving ? 'Guardando…' : 'Registrar gol'}</button>
      </div>
    </fieldset>
    <p className="match-form-status" role="status" aria-live="polite">{message}</p>
  </form>;
}

export function MatchDetail({ match, goals, roster, base, onRecorded, rosterError }) {
  const matchGoals = goalsForMatch(goals, match.id);
  return <details className="match-record">
    <summary><div className="match-record-summary"><span className="match-record-date">{match.date || 'Fecha pendiente'}{match.round != null && <small>Jornada {match.round}</small>}</span><strong>{match.home} <span aria-hidden="true">–</span> {match.away}</strong><span className="match-record-state">Finalizado</span><span className="match-record-open">Ver detalle <span aria-hidden="true">↓</span></span></div></summary>
    <div className="match-record-body">
      <dl className="match-information"><div><dt>Resultado oficial</dt><dd>Finalizado · marcador no disponible</dd></div><div><dt>Hora</dt><dd>{match.time || 'No indicada'}</dd></div><div><dt>Campo</dt><dd>{match.venue || 'No indicado'}</dd></div></dl>
      {match.observation && <p className="match-observation">{match.observation}</p>}
      <div className="match-statistics" aria-label="Estadísticas del partido">
        <section className="match-stat-section" aria-label="Goles del equipo">
          <div className="match-stat-heading"><div><p className="eyebrow">ACTA DEL EQUIPO</p><h3>Goleadores</h3></div><span className="match-stat-count">{matchGoals.length} {matchGoals.length === 1 ? 'gol registrado' : 'goles registrados'}</span></div>
          {matchGoals.length ? <ul className="match-goals">{matchGoals.map(goal => <li key={goal.id}><strong>{goal.player_name}</strong><span>{goal.minute == null ? 'Minuto no indicado' : `${goal.minute}′`}</span></li>)}</ul> : <p className="match-empty">Todavía no hay goles registrados para este partido.</p>}
          {rosterError ? <p className="match-empty" role="status">No se pudo cargar la plantilla. Pulsa Actualizar partidos para reintentar.</p> : roster.length ? <GoalForm match={match} roster={roster} base={base} onRecorded={onRecorded}/> : <p className="match-empty">Añade jugadores a la <a href="/equipo/#plantilla">plantilla</a> para registrar goles.</p>}
        </section>
      </div>
    </div>
  </details>;
}

export function MatchRecords({ team }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rosterError, setRosterError] = useState(false);
  const permitted = hasPermission(team?.roles || team?.role, 'goals.record');
  const base = `/api/teams/${encodeURIComponent(team?.id)}`;
  async function load(isCurrent = () => true) {
    setLoading(true);
    setError('');
    try {
      const access = await readJson(await api(`${base}/access`));
      if (!access.permissions.includes('goals.record')) throw new Error('No tienes permisos para consultar el acta del equipo.');
      const [matches, roster] = await Promise.allSettled([
        api(`${base}/matches`).then(readJson), api(`${base}/roster`).then(readJson)
      ]);
      if (!isCurrent()) return;
      if (matches.status === 'rejected') throw matches.reason;
      setRosterError(roster.status === 'rejected');
      setData({ ...matches.value, roster: roster.status === 'fulfilled' ? roster.value.filter(player => player.status === 'active') : [] });
    } catch (failure) { if (isCurrent()) setError(failure.message); }
    finally { if (isCurrent()) setLoading(false); }
  }
  useEffect(() => {
    if (!permitted) return;
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [base, permitted]);
  if (!permitted) return null;
  async function refreshGoals() {
    const matchData = await readJson(await api(`${base}/matches`));
    setData(current => ({ ...current, ...matchData }));
  }
  return <section className="panel match-records" aria-labelledby="match-records-title" aria-busy={loading}>
    <div className="section-heading"><div><p className="eyebrow">EL EQUIPO / PARTIDOS</p><h2 id="match-records-title">Resultados y actas</h2><p>{team.name} · Abre un partido para consultar y registrar sus goleadores.</p></div><button type="button" className="secondary" disabled={loading} onClick={() => load()}>Actualizar partidos</button></div>
    <p className="match-load-status" role="status" aria-live="polite">{loading ? 'Cargando partidos…' : error}</p>
    {data && <>{data.matches.length ? <div className="match-record-list">{data.matches.map(match => <MatchDetail key={match.id} match={match} goals={data.goals} roster={data.roster} base={base} onRecorded={refreshGoals} rosterError={rosterError}/>)}</div> : <p className="match-empty">Aún no hay partidos finalizados disponibles para este equipo. Los goleadores se registran cuando el encuentro figura como finalizado en la fuente oficial.</p>}</>}
  </section>;
}
