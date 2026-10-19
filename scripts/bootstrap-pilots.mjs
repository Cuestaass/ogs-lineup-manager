import { PILOT_TEAMS } from '../pilots.js';

const appUrl = String(process.env.APP_URL || '').replace(/\/$/, '');
const token = process.env.PILOT_BOOTSTRAP_TOKEN;
let emails;
try { emails = JSON.parse(process.env.PILOT_MANAGER_EMAILS || '{}'); } catch { emails = {}; }

if (!appUrl || !token || PILOT_TEAMS.some(team => !emails[team.slug])) {
  console.error('Configura APP_URL, PILOT_BOOTSTRAP_TOKEN y PILOT_MANAGER_EMAILS con los tres slugs piloto.');
  console.error(JSON.stringify(Object.fromEntries(PILOT_TEAMS.map(team => [team.slug, 'manager@ejemplo.com'])), null, 2));
  process.exit(1);
}

const response = await fetch(`${appUrl}/api/admin/pilots`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-pilot-bootstrap-token': token },
  body: JSON.stringify({ managers: PILOT_TEAMS.map(team => ({ teamSlug: team.slug, email: emails[team.slug] })) })
});
const result = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok || result.pilots?.some(item => item.state !== 'ready')) process.exitCode = 1;
