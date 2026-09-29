(() => {
  const STORAGE_KEY = 'fc-ogs-organizer-v1';

  const formations = {
    '321': [
      { x: 50, y: 88, role: 'POR' },
      { x: 20, y: 68, role: 'DEF' },
      { x: 50, y: 65, role: 'DEF' },
      { x: 80, y: 68, role: 'DEF' },
      { x: 32, y: 40, role: 'MED' },
      { x: 68, y: 40, role: 'MED' },
      { x: 50, y: 17, role: 'DEL' }
    ],
    '231': [
      { x: 50, y: 88, role: 'POR' },
      { x: 30, y: 68, role: 'DEF' },
      { x: 70, y: 68, role: 'DEF' },
      { x: 18, y: 42, role: 'MED' },
      { x: 50, y: 38, role: 'MED' },
      { x: 82, y: 42, role: 'MED' },
      { x: 50, y: 17, role: 'DEL' }
    ],
    '222': [
      { x: 50, y: 88, role: 'POR' },
      { x: 30, y: 68, role: 'DEF' },
      { x: 70, y: 68, role: 'DEF' },
      { x: 30, y: 43, role: 'MED' },
      { x: 70, y: 43, role: 'MED' },
      { x: 32, y: 18, role: 'DEL' },
      { x: 68, y: 18, role: 'DEL' }
    ],
    '132': [
      { x: 50, y: 88, role: 'POR' },
      { x: 50, y: 68, role: 'DEF' },
      { x: 18, y: 43, role: 'MED' },
      { x: 50, y: 39, role: 'MED' },
      { x: 82, y: 43, role: 'MED' },
      { x: 32, y: 18, role: 'DEL' },
      { x: 68, y: 18, role: 'DEL' }
    ],
    '312': [
      { x: 50, y: 88, role: 'POR' },
      { x: 20, y: 68, role: 'DEF' },
      { x: 50, y: 65, role: 'DEF' },
      { x: 80, y: 68, role: 'DEF' },
      { x: 50, y: 41, role: 'MED' },
      { x: 32, y: 18, role: 'DEL' },
      { x: 68, y: 18, role: 'DEL' }
    ]
  };

  const defaultState = () => ({
    nextTeamId: 2,
    nextPlayerId: 1,
    teams: [{ id: 1, name: 'FC OGS A', formation: '321', lineup: Array(7).fill(null) }],
    players: []
  });

  let state = loadState();
  let selected = null;
  let dragged = null;

  const dom = {
    newTeamName: document.getElementById('new-team-name'),
    addTeam: document.getElementById('add-team'),
    newPlayerName: document.getElementById('new-player-name'),
    newPlayerNumber: document.getElementById('new-player-number'),
    newPlayerTeams: document.getElementById('new-player-teams'),
    addPlayer: document.getElementById('add-player'),
    feedback: document.getElementById('feedback'),
    summaryGrid: document.getElementById('summary-grid'),
    playersBody: document.getElementById('players-body'),
    playersEmpty: document.getElementById('players-empty'),
    teamsContainer: document.getElementById('teams-container'),
    teamTemplate: document.getElementById('team-template'),
    exportAllPng: document.getElementById('export-all-png'),
    exportAllPdf: document.getElementById('export-all-pdf'),
    clearAll: document.getElementById('clear-all'),
    importRosterFile: document.getElementById('import-roster-file'),
    importRosterDropZone: document.getElementById('import-roster-drop-zone'),
    importRosterFileName: document.getElementById('import-roster-file-name')
  };

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || !Array.isArray(parsed.teams) || !parsed.teams.length || !Array.isArray(parsed.players)) return defaultState();
      parsed.teams.forEach(team => {
        if (!Array.isArray(team.lineup)) team.lineup = Array(7).fill(null);
        team.lineup = [...team.lineup.slice(0, 7), ...Array(7).fill(null)].slice(0, 7);
        if (!formations[team.formation]) team.formation = '321';
      });
      return parsed;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setFeedback(message) {
    dom.feedback.textContent = message;
  }

  function getTeam(id) {
    return state.teams.find(team => team.id === Number(id));
  }

  function getPlayer(id) {
    return state.players.find(player => player.id === Number(id));
  }

  function teamMembers(teamId) {
    return state.players.filter(player => player.teamIds.includes(Number(teamId)));
  }

  function teamBench(team) {
    const starters = new Set(team.lineup.filter(Boolean));
    return teamMembers(team.id).filter(player => !starters.has(player.id));
  }

  function getNextAutoNumber() {
    const used = new Set(state.players.map(player => Number(player.number)).filter(Number.isFinite));
    let value = 1;
    while (used.has(value)) value += 1;
    return value;
  }

  function getSuggestedTeamName() {
    const index = state.teams.length;
    if (index < 26) return `FC OGS ${String.fromCharCode(65 + index)}`;
    return `FC OGS ${index + 1}`;
  }

  function normalizeFileName(value) {
    return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'equipo';
  }

  function addTeam() {
    const name = dom.newTeamName.value.trim() || getSuggestedTeamName();
    state.teams.push({ id: state.nextTeamId++, name, formation: '321', lineup: Array(7).fill(null) });
    dom.newTeamName.value = '';
    saveState();
    render();
    setFeedback(`${name} se ha creado.`);
  }

  function deleteTeam(teamId) {
    if (state.teams.length <= 1) {
      setFeedback('Debe existir al menos un equipo.');
      return;
    }
    const team = getTeam(teamId);
    if (!team) return;
    if (!confirm(`¿Eliminar ${team.name}? Los jugadores no se borrarán.`)) return;
    state.teams = state.teams.filter(item => item.id !== team.id);
    state.players.forEach(player => {
      player.teamIds = player.teamIds.filter(id => id !== team.id);
    });
    selected = null;
    saveState();
    render();
    setFeedback(`${team.name} se ha eliminado.`);
  }

  function addPlayer() {
    const name = dom.newPlayerName.value.trim();
    if (!name) {
      setFeedback('Introduce el nombre del jugador.');
      dom.newPlayerName.focus();
      return;
    }

    const requested = Number(dom.newPlayerNumber.value);
    const number = Number.isInteger(requested) && requested > 0 ? requested : getNextAutoNumber();
    const teamIds = [...dom.newPlayerTeams.querySelectorAll('input[type="checkbox"]:checked')].map(input => Number(input.value));

    state.players.push({ id: state.nextPlayerId++, name, number, teamIds });
    dom.newPlayerName.value = '';
    dom.newPlayerNumber.value = '';
    saveState();
    render();
    setFeedback(`${name} se ha añadido con el dorsal ${number}.`);
    dom.newPlayerName.focus();
  }

  function decodePdfString(value) {
    return value.replace(/\\([nrtbf()\\])/g, (_, escaped) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[escaped]))
      .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
      .replace(/\\\r?\n/g, '');
  }

  function pdfTextRecords(content) {
    const records = [];
    const textBlocks = content.matchAll(/\bBT\b([\s\S]*?)\bET\b/g);
    for (const blockMatch of textBlocks) {
      const block = blockMatch[1];
      const placements = [...block.matchAll(/(-?(?:\d+\.?\d*|\.\d+))\s+(-?(?:\d+\.?\d*|\.\d+))\s+Tm\b/g)];
      placements.forEach((placement, index) => {
        const start = placement.index + placement[0].length;
        const end = placements[index + 1]?.index ?? block.length;
        const fragment = block.slice(start, end);
        const textMatches = [...fragment.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj\b/g)];
        if (!textMatches.length) return;
        records.push({
          x: Number(placement[1]),
          y: Number(placement[2]),
          text: textMatches.map(match => decodePdfString(match[1])).join(' ').trim()
        });
      });
    }
    return records.filter(record => record.text);
  }

  async function extractPdfRecords(file) {
    if (file.size > 15 * 1024 * 1024) throw new Error('La ficha supera el límite de 15 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const header = new TextDecoder('latin1').decode(bytes.subarray(0, 8));
    if (!header.startsWith('%PDF-')) throw new Error('El archivo seleccionado no parece ser un PDF válido.');
    const source = new TextDecoder('latin1').decode(bytes);
    const streamPattern = /(\d+\s+\d+\s+obj\b[\s\S]*?)stream\r?\n/g;
    const records = [];
    let streamMatch;
    while ((streamMatch = streamPattern.exec(source))) {
      const streamStart = streamPattern.lastIndex;
      const streamEnd = source.indexOf('endstream', streamStart);
      if (streamEnd < 0) break;
      const dictionary = streamMatch[1];
      let streamBytes = bytes.subarray(streamStart, streamEnd);
      while (streamBytes.length && (streamBytes[streamBytes.length - 1] === 10 || streamBytes[streamBytes.length - 1] === 13)) streamBytes = streamBytes.subarray(0, streamBytes.length - 1);
      if (/\/FlateDecode\b/.test(dictionary)) {
        if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede descomprimir la ficha PDF. Prueba con una versión reciente.');
        try {
          const decompressed = await new Response(new Blob([streamBytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
          records.push(...pdfTextRecords(new TextDecoder('latin1').decode(decompressed)));
        } catch {
          // Image and other binary streams are not text; ignore them.
        }
      } else if (!/\/Subtype\s*\/Image\b/.test(dictionary)) {
        records.push(...pdfTextRecords(new TextDecoder('latin1').decode(streamBytes)));
      }
      streamPattern.lastIndex = streamEnd + 'endstream'.length;
    }
    return records;
  }

  function groupPdfRows(records) {
    const sorted = [...records].sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    sorted.forEach(record => {
      let row = rows.find(candidate => Math.abs(candidate.y - record.y) <= 1.5);
      if (!row) {
        row = { y: record.y, records: [] };
        rows.push(row);
      }
      row.records.push(record);
    });
    return rows;
  }

  function normalizePlayerName(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
  }

  async function importRoster(file) {
    try {
      const rows = groupPdfRows(await extractPdfRecords(file));
      const teamRow = rows.find(row => row.records.some(record => /^equipo:?$/i.test(record.text)));
      const teamLabel = teamRow?.records.find(record => /^equipo:?$/i.test(record.text));
      const teamName = teamRow?.records.find(record => teamLabel && record.x > teamLabel.x + 5)?.text.trim();
      if (!teamName) throw new Error('No he encontrado el nombre del equipo en la ficha.');

      const documentHeader = rows.flatMap(row => row.records).find(record => /^documento$/i.test(record.text));
      const documentColumnX = documentHeader?.x ?? 300;
      const names = rows.flatMap(row => {
        const role = row.records.find(record => /^deportista$/i.test(record.text));
        if (!role) return [];
        const name = row.records.find(record => record.x > role.x + 20 && record.x < documentColumnX && record.text.length > 2);
        return name ? [name.text.replace(/\s+/g, ' ').trim()] : [];
      }).filter(Boolean);
      if (!names.length) throw new Error('No he encontrado jugadores con el rol “Deportista”. Comprueba que el PDF contenga texto seleccionable.');

      const team = state.teams.find(item => normalizePlayerName(item.name) === normalizePlayerName(teamName)) || null;
      const existingTeamMembers = team ? teamMembers(team.id) : [];
      const alreadyInTeam = new Set(existingTeamMembers.map(player => normalizePlayerName(player.name)));
      const uniqueNames = [...new Map(names.map(name => [normalizePlayerName(name), name])).values()];
      const toAdd = uniqueNames.filter(name => !alreadyInTeam.has(normalizePlayerName(name)));
      const skipped = names.length - toAdd.length;
      const verb = toAdd.length === 1 ? 'jugador nuevo' : 'jugadores nuevos';
      if (!confirm(`Ficha del equipo ${teamName}: ${names.length} deportistas. Se añadirán ${toAdd.length} ${verb}${skipped ? ` y se omitirán ${skipped} que ya están en el equipo` : ''}. Quedarán en el banquillo. ¿Continuar?`)) return;

      let destinationTeam = team;
      if (!destinationTeam) {
        destinationTeam = { id: state.nextTeamId++, name: teamName, formation: '321', lineup: Array(7).fill(null) };
        state.teams.push(destinationTeam);
      }
      toAdd.forEach(name => {
        const samePlayer = state.players.find(player => normalizePlayerName(player.name) === normalizePlayerName(name));
        if (samePlayer) {
          if (!samePlayer.teamIds.includes(destinationTeam.id)) samePlayer.teamIds.push(destinationTeam.id);
        } else {
          state.players.push({ id: state.nextPlayerId++, name, number: getNextAutoNumber(), teamIds: [destinationTeam.id] });
        }
      });
      selected = null;
      saveState();
      render();
      setFeedback(`${destinationTeam.name}: ${toAdd.length} deportistas añadidos al banquillo${skipped ? `; ${skipped} ya estaban en el equipo` : ''}.`);
    } catch (error) {
      setFeedback(error.message || 'No se pudo leer la ficha PDF.');
    } finally {
      dom.importRosterFile.value = '';
    }
  }

  function removePlayer(playerId) {
    const player = getPlayer(playerId);
    if (!player) return;
    state.players = state.players.filter(item => item.id !== player.id);
    state.teams.forEach(team => {
      team.lineup = team.lineup.map(id => id === player.id ? null : id);
    });
    selected = null;
    saveState();
    render();
    setFeedback(`${player.name} se ha eliminado.`);
  }

  function updatePlayerMembership(playerId, teamId, checked) {
    const player = getPlayer(playerId);
    const team = getTeam(teamId);
    if (!player || !team) return;

    if (checked && !player.teamIds.includes(team.id)) player.teamIds.push(team.id);
    if (!checked) {
      player.teamIds = player.teamIds.filter(id => id !== team.id);
      team.lineup = team.lineup.map(id => id === player.id ? null : id);
    }
    selected = null;
    saveState();
    render();
  }

  function movePlayer(teamId, playerId, destination) {
    const team = getTeam(teamId);
    const player = getPlayer(playerId);
    if (!team || !player || !player.teamIds.includes(team.id)) return;

    const currentIndex = team.lineup.indexOf(player.id);
    if (currentIndex >= 0) team.lineup[currentIndex] = null;

    if (destination !== 'bench') {
      const slotIndex = Number(destination);
      const occupied = team.lineup[slotIndex];
      team.lineup[slotIndex] = player.id;
      if (occupied && occupied !== player.id && currentIndex >= 0) team.lineup[currentIndex] = occupied;
    }

    selected = null;
    saveState();
    render();
  }

  function autoLineup(teamId) {
    const team = getTeam(teamId);
    if (!team) return;
    const members = teamMembers(team.id);
    team.lineup = Array(7).fill(null);
    members.slice(0, 7).forEach((player, index) => { team.lineup[index] = player.id; });
    saveState();
    render();
    setFeedback(`${team.name}: se han alineado hasta siete jugadores.`);
  }

  function benchAll(teamId) {
    const team = getTeam(teamId);
    if (!team) return;
    team.lineup = Array(7).fill(null);
    selected = null;
    saveState();
    render();
  }

  function renderNewPlayerTeamChecks() {
    dom.newPlayerTeams.innerHTML = '<legend>Asignar a equipos</legend>';
    const row = document.createElement('div');
    row.className = 'checkbox-row';
    state.teams.forEach((team, index) => {
      const label = document.createElement('label');
      label.className = 'check-label';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = team.id;
      input.checked = index === 0;
      label.append(input, document.createTextNode(team.name));
      row.appendChild(label);
    });
    dom.newPlayerTeams.appendChild(row);
  }

  function renderSummary() {
    dom.summaryGrid.innerHTML = '';
    const cards = [
      ['Jugadores únicos', state.players.length],
      ['Equipos', state.teams.length],
      ['Asignaciones', state.players.reduce((sum, player) => sum + player.teamIds.length, 0)]
    ];
    state.teams.forEach(team => cards.push([team.name, teamMembers(team.id).length]));
    cards.forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'summary-card';
      card.innerHTML = `<span></span><strong></strong>`;
      card.querySelector('span').textContent = label;
      card.querySelector('strong').textContent = value;
      dom.summaryGrid.appendChild(card);
    });
  }

  function renderPlayers() {
    dom.playersBody.innerHTML = '';
    dom.playersEmpty.hidden = state.players.length > 0;

    state.players.forEach(player => {
      const row = document.createElement('tr');

      const numberCell = document.createElement('td');
      const numberInput = document.createElement('input');
      numberInput.type = 'number';
      numberInput.min = '1';
      numberInput.max = '999';
      numberInput.className = 'number-input';
      numberInput.value = player.number;
      numberInput.addEventListener('change', () => {
        const value = Number(numberInput.value);
        player.number = Number.isInteger(value) && value > 0 ? value : getNextAutoNumber();
        saveState();
        render();
      });
      numberCell.appendChild(numberInput);

      const nameCell = document.createElement('td');
      nameCell.className = 'player-name-cell';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.maxLength = 80;
      nameInput.className = 'name-input';
      nameInput.value = player.name;
      nameInput.setAttribute('aria-label', `Nombre de ${player.name}`);
      nameInput.addEventListener('change', () => {
        const value = nameInput.value.trim();
        if (!value) {
          nameInput.value = player.name;
          setFeedback('El nombre del jugador no puede estar vacío.');
          return;
        }
        player.name = value;
        saveState();
        render();
      });
      nameCell.appendChild(nameInput);

      const teamsCell = document.createElement('td');
      const checks = document.createElement('div');
      checks.className = 'checkbox-row';
      state.teams.forEach(team => {
        const label = document.createElement('label');
        label.className = 'check-label';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = player.teamIds.includes(team.id);
        input.addEventListener('change', () => updatePlayerMembership(player.id, team.id, input.checked));
        label.append(input, document.createTextNode(team.name));
        checks.appendChild(label);
      });
      teamsCell.appendChild(checks);

      const actionCell = document.createElement('td');
      const remove = document.createElement('button');
      remove.className = 'danger ghost';
      remove.textContent = 'Eliminar';
      remove.addEventListener('click', () => removePlayer(player.id));
      actionCell.appendChild(remove);

      row.append(numberCell, nameCell, teamsCell, actionCell);
      dom.playersBody.appendChild(row);
    });
  }

  function createPlayerChip(player, team) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'player-chip';
    chip.draggable = true;
    chip.title = `#${player.number} ${player.name}`;
    if (selected && selected.teamId === team.id && selected.playerId === player.id) chip.classList.add('selected');

    const number = document.createElement('span');
    number.className = 'shirt-number';
    number.textContent = player.number;
    const name = document.createElement('span');
    name.className = 'chip-name';
    name.textContent = player.name;
    chip.append(number, name);

    chip.addEventListener('click', event => {
      event.stopPropagation();
      const same = selected && selected.teamId === team.id && selected.playerId === player.id;
      selected = same ? null : { teamId: team.id, playerId: player.id };
      renderTeams();
    });

    chip.addEventListener('dragstart', event => {
      dragged = { teamId: team.id, playerId: player.id };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${team.id}:${player.id}`);
    });
    chip.addEventListener('dragend', () => {
      dragged = null;
      document.querySelectorAll('.drop-active').forEach(element => element.classList.remove('drop-active'));
    });
    return chip;
  }

  function configureTarget(element, team, destination) {
    element.addEventListener('dragover', event => {
      if (!dragged || dragged.teamId !== team.id) return;
      event.preventDefault();
      element.classList.add('drop-active');
    });
    element.addEventListener('dragleave', () => element.classList.remove('drop-active'));
    element.addEventListener('drop', event => {
      event.preventDefault();
      element.classList.remove('drop-active');
      if (dragged && dragged.teamId === team.id) movePlayer(team.id, dragged.playerId, destination);
    });
    element.addEventListener('click', () => {
      if (selected && selected.teamId === team.id) movePlayer(team.id, selected.playerId, destination);
    });
  }

  function renderTeams() {
    dom.teamsContainer.innerHTML = '';
    state.teams.forEach(team => {
      const card = dom.teamTemplate.content.firstElementChild.cloneNode(true);
      card.dataset.teamId = team.id;

      const nameInput = card.querySelector('.team-name-input');
      nameInput.value = team.name;
      nameInput.addEventListener('change', () => {
        team.name = nameInput.value.trim() || getSuggestedTeamName();
        saveState();
        render();
      });

      const members = teamMembers(team.id);
      const starters = team.lineup.filter(Boolean).length;
      const bench = teamBench(team);
      card.querySelector('.team-meta').textContent = `${members.length} jugadores · ${starters} titulares · ${bench.length} suplentes`;

      const formationSelect = card.querySelector('.formation-select');
      formationSelect.value = team.formation;
      formationSelect.addEventListener('change', () => {
        team.formation = formationSelect.value;
        saveState();
        renderTeams();
      });

      card.querySelector('.auto-lineup').addEventListener('click', () => autoLineup(team.id));
      card.querySelector('.bench-all').addEventListener('click', () => benchAll(team.id));
      card.querySelector('.delete-team').addEventListener('click', () => deleteTeam(team.id));
      card.querySelector('.export-png').addEventListener('click', () => exportTeamsPng([team]));
      card.querySelector('.export-pdf').addEventListener('click', () => exportTeamsPdf([team]));

      const formation = formations[team.formation];
      card.querySelectorAll('.pitch-slot').forEach(slot => {
        const index = Number(slot.dataset.slot);
        const position = formation[index];
        slot.style.left = `${position.x}%`;
        slot.style.top = `${position.y}%`;
        if (selected && selected.teamId === team.id) slot.classList.add('selected-target');

        const role = document.createElement('span');
        role.className = 'slot-role';
        role.textContent = position.role;
        slot.appendChild(role);
        const player = getPlayer(team.lineup[index]);
        if (player) slot.appendChild(createPlayerChip(player, team));
        configureTarget(slot, team, index);
      });

      const benchElement = card.querySelector('.bench');
      if (selected && selected.teamId === team.id) benchElement.classList.add('selected-target');
      card.querySelector('.bench-count').textContent = `${bench.length} jugadores`;
      if (!bench.length) {
        const empty = document.createElement('div');
        empty.className = 'bench-empty';
        empty.textContent = members.length ? 'No hay suplentes' : 'No hay jugadores asignados';
        benchElement.appendChild(empty);
      } else {
        bench.forEach(player => benchElement.appendChild(createPlayerChip(player, team)));
      }
      configureTarget(benchElement, team, 'bench');

      const list = card.querySelector('.team-roster-list');
      const ordered = [
        ...team.lineup.map(id => getPlayer(id)).filter(Boolean).map(player => ({ player, status: 'Titular' })),
        ...bench.map(player => ({ player, status: 'Suplente' }))
      ];
      if (!ordered.length) {
        const item = document.createElement('li');
        item.textContent = 'Sin jugadores';
        list.appendChild(item);
      } else {
        ordered.forEach(({ player, status }) => {
          const item = document.createElement('li');
          item.innerHTML = `<strong></strong> · ${status}`;
          item.querySelector('strong').textContent = `#${player.number} ${player.name}`;
          list.appendChild(item);
        });
      }

      dom.teamsContainer.appendChild(card);
    });
  }

  function render() {
    renderNewPlayerTeamChecks();
    renderSummary();
    renderPlayers();
    renderTeams();
    dom.exportAllPng.disabled = !state.teams.length;
    dom.exportAllPdf.disabled = !state.teams.length;
  }

  function svgEscape(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function teamSvg(team) {
    const width = 1200;
    const height = 1620;
    const field = { x: 90, y: 120, w: 1020, h: 1180 };
    const formation = formations[team.formation];
    const bench = teamBench(team);

    const playerSvg = team.lineup.map((id, index) => {
      const player = getPlayer(id);
      if (!player) return '';
      const pos = formation[index];
      const cx = field.x + field.w * pos.x / 100;
      const cy = field.y + field.h * pos.y / 100;
      return `<g><circle cx="${cx}" cy="${cy}" r="49" fill="#f7f8f7" stroke="#12251a" stroke-width="5"/><circle cx="${cx - 34}" cy="${cy - 34}" r="24" fill="#12251a"/><text x="${cx - 34}" y="${cy - 26}" text-anchor="middle" font-family="Arial" font-size="25" font-weight="700" fill="#f3c449">${svgEscape(player.number)}</text><text x="${cx}" y="${cy + 8}" text-anchor="middle" font-family="Arial" font-size="27" font-weight="700" fill="#12251a">${svgEscape(player.name.slice(0, 18))}</text></g>`;
    }).join('');

    const benchStartY = 1395;
    const benchPlayers = bench.map((player, index) => {
      const columns = 5;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = 125 + col * 210;
      const y = benchStartY + row * 70;
      return `<g><rect x="${x}" y="${y}" width="188" height="52" rx="16" fill="#f7f8f7" stroke="#31483a" stroke-width="3"/><circle cx="${x + 28}" cy="${y + 26}" r="19" fill="#12251a"/><text x="${x + 28}" y="${y + 34}" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="#f3c449">${svgEscape(player.number)}</text><text x="${x + 55}" y="${y + 34}" font-family="Arial" font-size="22" font-weight="700" fill="#12251a">${svgEscape(player.name.slice(0, 15))}</text></g>`;
    }).join('');

    const dynamicHeight = Math.max(height, benchStartY + Math.ceil(bench.length / 5) * 70 + 70);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${dynamicHeight}" viewBox="0 0 ${width} ${dynamicHeight}">
      <rect width="100%" height="100%" fill="#09110d"/>
      <text x="90" y="72" font-family="Arial" font-size="42" font-weight="700" fill="#f4f8f5">${svgEscape(team.name)}</text>
      <text x="1110" y="72" text-anchor="end" font-family="Arial" font-size="28" fill="#f3c449">Formación ${svgEscape(formationLabel(team.formation))}</text>
      <defs><pattern id="grass" width="204" height="100" patternUnits="userSpaceOnUse"><rect width="102" height="100" fill="#28633d"/><rect x="102" width="102" height="100" fill="#225735"/></pattern></defs>
      <rect x="${field.x}" y="${field.y}" width="${field.w}" height="${field.h}" rx="12" fill="url(#grass)" stroke="#ffffff" stroke-width="7"/>
      <line x1="${field.x}" y1="${field.y + field.h / 2}" x2="${field.x + field.w}" y2="${field.y + field.h / 2}" stroke="#ffffff" stroke-width="5" opacity=".85"/>
      <circle cx="${field.x + field.w / 2}" cy="${field.y + field.h / 2}" r="125" fill="none" stroke="#ffffff" stroke-width="5" opacity=".85"/>
      <circle cx="${field.x + field.w / 2}" cy="${field.y + field.h / 2}" r="6" fill="#ffffff"/>
      <rect x="${field.x + 250}" y="${field.y}" width="520" height="205" fill="none" stroke="#ffffff" stroke-width="5" opacity=".85"/>
      <rect x="${field.x + 250}" y="${field.y + field.h - 205}" width="520" height="205" fill="none" stroke="#ffffff" stroke-width="5" opacity=".85"/>
      <rect x="${field.x + 410}" y="${field.y - 1}" width="200" height="35" fill="none" stroke="#ffffff" stroke-width="5" opacity=".85"/>
      <rect x="${field.x + 410}" y="${field.y + field.h - 34}" width="200" height="35" fill="none" stroke="#ffffff" stroke-width="5" opacity=".85"/>
      ${playerSvg}
      <rect x="90" y="1340" width="1020" height="${dynamicHeight - 1375}" rx="18" fill="#16241c" stroke="#31483a" stroke-width="4"/>
      <text x="115" y="1380" font-family="Arial" font-size="28" font-weight="700" fill="#f4f8f5">Banquillo · ${bench.length} jugadores</text>
      ${benchPlayers || `<text x="600" y="1465" text-anchor="middle" font-family="Arial" font-size="26" fill="#9fb1a5">Sin suplentes</text>`}
    </svg>`;
  }

  function formationLabel(value) {
    return value.split('').join('-');
  }

  async function svgToCanvas(svg) {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportTeamsPng(teams) {
    try {
      setFeedback('Generando imagen…');
      const canvases = [];
      for (const team of teams) canvases.push(await svgToCanvas(teamSvg(team)));

      let output;
      if (canvases.length === 1) {
        output = canvases[0];
      } else {
        const gap = 36;
        output = document.createElement('canvas');
        output.width = Math.max(...canvases.map(canvas => canvas.width));
        output.height = canvases.reduce((sum, canvas) => sum + canvas.height, 0) + gap * (canvases.length - 1);
        const context = output.getContext('2d');
        context.fillStyle = '#09110d';
        context.fillRect(0, 0, output.width, output.height);
        let y = 0;
        canvases.forEach(canvas => {
          context.drawImage(canvas, 0, y);
          y += canvas.height + gap;
        });
      }
      output.toBlob(blob => {
        if (!blob) return;
        const filename = teams.length === 1 ? `${normalizeFileName(teams[0].name)}-alineacion.png` : 'FC-OGS-todos-los-equipos.png';
        downloadBlob(blob, filename);
        setFeedback('Imagen exportada correctamente.');
      }, 'image/png');
    } catch (error) {
      console.error(error);
      setFeedback('No se pudo generar la imagen.');
    }
  }

  function pdfEscape(text) {
    return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\()]/g, match => `\\${match}`).replace(/[^\x20-\x7E]/g, '?');
  }

  function pdfText(text, x, y, size = 12, font = 'F1') {
    return `BT /${font} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(text)}) Tj ET\n`;
  }

  function pdfCircle(x, y, radius, fill = true) {
    const c = radius * 0.5522847498;
    return `${x + radius} ${y} m ${x + radius} ${y + c} ${x + c} ${y + radius} ${x} ${y + radius} c ${x - c} ${y + radius} ${x - radius} ${y + c} ${x - radius} ${y} c ${x - radius} ${y - c} ${x - c} ${y - radius} ${x} ${y - radius} c ${x + c} ${y - radius} ${x + radius} ${y - c} ${x + radius} ${y} c ${fill ? 'f' : 'S'}\n`;
  }

  function teamPdfContent(team) {
    const pageW = 842;
    const pageH = 595;
    const field = { x: 35, y: 82, w: 390, h: 465 };
    const formation = formations[team.formation];
    const members = teamMembers(team.id);
    const bench = teamBench(team);
    let out = '';

    out += '0.05 0.09 0.07 rg 0 0 842 595 re f\n';
    out += pdfText(team.name, 35, 565, 22, 'F2');
    out += pdfText(`Formacion ${formationLabel(team.formation)} · ${members.length} jugadores`, 35, 542, 11, 'F1');

    out += '0.14 0.37 0.23 rg ' + `${field.x} ${field.y} ${field.w} ${field.h} re f\n`;
    out += '1 1 1 RG 2 w ' + `${field.x} ${field.y} ${field.w} ${field.h} re S\n`;
    out += `${field.x} ${field.y + field.h / 2} m ${field.x + field.w} ${field.y + field.h / 2} l S\n`;
    out += pdfCircle(field.x + field.w / 2, field.y + field.h / 2, 47, false);
    out += `${field.x + 95} ${field.y} 200 78 re S\n`;
    out += `${field.x + 95} ${field.y + field.h - 78} 200 78 re S\n`;

    team.lineup.forEach((id, index) => {
      const player = getPlayer(id);
      if (!player) return;
      const position = formation[index];
      const x = field.x + field.w * position.x / 100;
      const y = field.y + field.h * (100 - position.y) / 100;
      out += '0.96 0.97 0.96 rg ' + pdfCircle(x, y, 19, true);
      out += '0.07 0.14 0.10 rg ' + pdfCircle(x - 13, y + 13, 9, true);
      out += '0.95 0.77 0.29 rg ' + pdfText(player.number, x - 18, y + 10, 7, 'F2');
      out += '0.07 0.14 0.10 rg ' + pdfText(player.name.slice(0, 15), x - 25, y - 4, 7, 'F2');
    });

    out += '0.10 0.17 0.13 rg 35 22 390 48 re f\n';
    out += '0.70 0.78 0.72 rg ' + pdfText(`Banquillo: ${bench.length}`, 45, 54, 10, 'F2');
    bench.slice(0, 10).forEach((player, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      out += '0.95 0.97 0.95 rg ' + `${45 + col * 74} ${26 + row * 20} 68 16 re f\n`;
      out += '0.07 0.14 0.10 rg ' + pdfText(`#${player.number} ${player.name.slice(0, 8)}`, 48 + col * 74, 31 + row * 20, 6.5, 'F2');
    });

    out += '0.95 0.97 0.95 rg ' + pdfText('Lista del equipo', 465, 542, 16, 'F2');
    let rosterY = 516;
    const starterIds = new Set(team.lineup.filter(Boolean));
    members.forEach((player, index) => {
      if (rosterY < 45) return;
      const status = starterIds.has(player.id) ? 'Titular' : 'Suplente';
      out += index % 2 === 0 ? '0.10 0.17 0.13 rg ' : '0.12 0.20 0.15 rg ';
      out += `460 ${rosterY - 4} 340 22 re f\n`;
      out += '0.95 0.97 0.95 rg ' + pdfText(`${index + 1}. #${player.number} ${player.name}`, 470, rosterY + 2, 9.5, 'F2');
      out += '0.70 0.78 0.72 rg ' + pdfText(status, 735, rosterY + 2, 8.5, 'F1');
      rosterY -= 25;
    });
    if (!members.length) out += '0.70 0.78 0.72 rg ' + pdfText('Sin jugadores asignados', 465, 510, 11, 'F1');
    return out;
  }

  function buildPdf(teams) {
    const pageIds = [];
    const contentIds = [];
    teams.forEach((_, index) => {
      pageIds.push(3 + index * 2);
      contentIds.push(4 + index * 2);
    });
    const fontRegularId = 3 + teams.length * 2;
    const fontBoldId = fontRegularId + 1;
    const objects = new Map();

    objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objects.set(2, `<< /Type /Pages /Count ${teams.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`);

    teams.forEach((team, index) => {
      const pageId = pageIds[index];
      const contentId = contentIds[index];
      const content = teamPdfContent(team);
      objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      objects.set(contentId, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
    });

    objects.set(fontRegularId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects.set(fontBoldId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    let pdf = '%PDF-1.4\n%âãÏÓ\n';
    const offsets = [0];
    const maxId = fontBoldId;
    for (let id = 1; id <= maxId; id += 1) {
      offsets[id] = binaryLength(pdf);
      pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
    }
    const xrefOffset = binaryLength(pdf);
    pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= maxId; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return binaryStringToBlob(pdf, 'application/pdf');
  }

  function binaryLength(value) {
    return value.length;
  }

  function binaryStringToBlob(value, type) {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 255;
    return new Blob([bytes], { type });
  }

  function exportTeamsPdf(teams) {
    try {
      const blob = buildPdf(teams);
      const filename = teams.length === 1 ? `${normalizeFileName(teams[0].name)}-datos-y-alineacion.pdf` : 'FC-OGS-todos-los-equipos.pdf';
      downloadBlob(blob, filename);
      setFeedback('PDF exportado correctamente.');
    } catch (error) {
      console.error(error);
      setFeedback('No se pudo generar el PDF.');
    }
  }

  function handleRosterFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFeedback('Selecciona un archivo PDF para importar la ficha.');
      dom.importRosterFile.value = '';
      return;
    }
    dom.importRosterFileName.textContent = file.name;
    importRoster(file);
  }

  function clearRosterDropState() {
    dom.importRosterDropZone.classList.remove('drag-active');
  }

  dom.addTeam.addEventListener('click', addTeam);
  dom.newTeamName.addEventListener('keydown', event => { if (event.key === 'Enter') addTeam(); });
  dom.addPlayer.addEventListener('click', addPlayer);
  dom.newPlayerName.addEventListener('keydown', event => { if (event.key === 'Enter') addPlayer(); });
  dom.importRosterFile.addEventListener('change', () => {
    handleRosterFile(dom.importRosterFile.files[0]);
  });
  dom.importRosterDropZone.addEventListener('dragenter', event => {
    if (![...event.dataTransfer.types].includes('Files')) return;
    event.preventDefault();
    dom.importRosterDropZone.classList.add('drag-active');
  });
  dom.importRosterDropZone.addEventListener('dragover', event => {
    if (![...event.dataTransfer.types].includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    dom.importRosterDropZone.classList.add('drag-active');
  });
  dom.importRosterDropZone.addEventListener('dragleave', event => {
    if (!dom.importRosterDropZone.contains(event.relatedTarget)) clearRosterDropState();
  });
  dom.importRosterDropZone.addEventListener('drop', event => {
    event.preventDefault();
    clearRosterDropState();
    handleRosterFile(event.dataTransfer.files[0]);
  });
  dom.exportAllPng.addEventListener('click', () => exportTeamsPng(state.teams));
  dom.exportAllPdf.addEventListener('click', () => exportTeamsPdf(state.teams));
  dom.clearAll.addEventListener('click', () => {
    if (!confirm('¿Borrar todos los equipos y jugadores?')) return;
    state = defaultState();
    selected = null;
    saveState();
    render();
    setFeedback('Se han borrado todos los datos.');
  });

  render();
})();
