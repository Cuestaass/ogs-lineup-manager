const CALENDAR_TIME_ZONE = 'Europe/Madrid';

export function parseFixtureDate(value) {
  if (!value) return null;
  const parts = String(value).trim().match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/);
  if (parts) {
    const yearFirst = parts[1].length === 4;
    const year = Number(yearFirst ? parts[1] : parts[3]);
    const month = Number(parts[2]);
    const day = Number(yearFirst ? parts[3] : parts[1]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFixtureTime(value) {
  const normalized = String(value || '').trim().replace(':', '').padStart(4, '0');
  if (!/^\d{4}$/.test(normalized)) return null;
  const hours = Number(normalized.slice(0, 2));
  const minutes = Number(normalized.slice(2));
  return hours < 24 && minutes < 60 ? { hours, minutes } : null;
}

const pad = value => String(value).padStart(2, '0');
const calendarDate = date => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
const localDateTime = (date, time) => `${calendarDate(date)}T${pad(time.hours)}${pad(time.minutes)}00`;
const utcDateTime = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const escapeIcs = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
const validFixture = fixture => fixture?.scheduled && !['F', 'N'].includes(fixture.status) && parseFixtureDate(fixture.date);

function eventValues(team, fixture) {
  const date = parseFixtureDate(fixture.date);
  const time = parseFixtureTime(fixture.time);
  const title = `${fixture.home || 'Equipo local'} – ${fixture.away || 'Equipo visitante'}`;
  const location = fixture.venue || '';
  const description = `Partido de ${team.name || 'tu equipo'}. Fuente: Ayuntamiento de Madrid.`;
  let start;
  let end;
  if (time) {
    const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hours + 2, time.minutes);
    start = localDateTime(date, time);
    end = `${calendarDate(endDate)}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
  } else {
    const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    start = calendarDate(date);
    end = calendarDate(nextDay);
  }
  return { date, time, title, location, description, start, end };
}

export function googleCalendarUrl(team, fixture) {
  if (!validFixture(fixture)) return '';
  const values = eventValues(team, fixture);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: values.title,
    dates: `${values.start}/${values.end}`,
    details: values.description,
    location: values.location,
    ctz: CALENDAR_TIME_ZONE
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function createCalendar(teams, now = new Date()) {
  const events = [];
  const seen = new Set();
  for (const team of teams || []) {
    for (const fixture of team.fixtures || []) {
      if (!validFixture(fixture)) continue;
      const key = `${team.slug || team.name}:${fixture.id || `${fixture.date}:${fixture.time}:${fixture.home}:${fixture.away}`}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const values = eventValues(team, fixture);
      const uid = `${key.replace(/[^A-Za-z0-9._-]+/g, '-')}@lineups.ladderly.es`;
      const dateLines = values.time
        ? [`DTSTART;TZID=${CALENDAR_TIME_ZONE}:${values.start}`, `DTEND;TZID=${CALENDAR_TIME_ZONE}:${values.end}`]
        : [`DTSTART;VALUE=DATE:${values.start}`, `DTEND;VALUE=DATE:${values.end}`];
      events.push([
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${utcDateTime(now)}`,
        ...dateLines,
        `SUMMARY:${escapeIcs(values.title)}`,
        `DESCRIPTION:${escapeIcs(values.description)}`,
        ...(values.location ? [`LOCATION:${escapeIcs(values.location)}`] : []),
        'STATUS:CONFIRMED',
        'END:VEVENT'
      ].join('\r\n'));
    }
  }
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cuaderno de campo//Partidos JDM//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Partidos · Cuaderno de campo',
    `X-WR-TIMEZONE:${CALENDAR_TIME_ZONE}`,
    ...events,
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

export function fixtureCount(teams) {
  return (teams || []).reduce((total, team) => total + (team.fixtures || []).filter(validFixture).length, 0);
}
