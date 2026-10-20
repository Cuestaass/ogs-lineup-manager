import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCalendar, fixtureCount, googleCalendarUrl, parseFixtureDate } from '../public/calendar.js';

const team = {
  slug: 'fc-ogs',
  name: 'FC OGS',
  fixtures: [{ id: 'match-1', date: '24/10/2026', time: '12:30', venue: 'Campo 1, Madrid', home: 'FC OGS', away: 'Rival; Norte', scheduled: true, status: 'R' }]
};

test('genera un calendario ICS compatible con zona horaria de Madrid', () => {
  const calendar = createCalendar([team], new Date('2026-10-20T10:00:00Z'));
  assert.match(calendar, /^BEGIN:VCALENDAR\r\nVERSION:2.0/);
  assert.match(calendar, /DTSTART;TZID=Europe\/Madrid:20261024T123000/);
  assert.match(calendar, /DTEND;TZID=Europe\/Madrid:20261024T143000/);
  assert.match(calendar, /SUMMARY:FC OGS – Rival\\; Norte/);
  assert.match(calendar, /LOCATION:Campo 1\\, Madrid/);
  assert.match(calendar, /UID:fc-ogs-match-1@lineups\.ladderly\.es/);
});

test('Google Calendar recibe los datos del partido', () => {
  const url = new URL(googleCalendarUrl(team, team.fixtures[0]));
  assert.equal(url.origin, 'https://calendar.google.com');
  assert.equal(url.searchParams.get('dates'), '20261024T123000/20261024T143000');
  assert.equal(url.searchParams.get('ctz'), 'Europe/Madrid');
  assert.equal(url.searchParams.get('location'), 'Campo 1, Madrid');
});

test('admite fechas oficiales y excluye partidos finalizados', () => {
  assert.equal(parseFixtureDate('2026-10-24')?.getDate(), 24);
  assert.equal(parseFixtureDate('24/10/2026')?.getMonth(), 9);
  assert.equal(fixtureCount([{ ...team, fixtures: [...team.fixtures, { ...team.fixtures[0], id: 'done', status: 'F' }] }]), 1);
});
