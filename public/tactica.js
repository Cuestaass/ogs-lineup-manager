(() => {
  const STORAGE_KEY = 'fc-ogs-tactics-v1';
  const board = document.getElementById('tactics-board');
  const drawingLayer = document.getElementById('tactics-drawing-layer');
  const pieceLayer = document.getElementById('tactics-piece-layer');
  const previewLayer = document.getElementById('tactics-preview-layer');
  const status = document.getElementById('tactics-status');
  const undoButton = document.getElementById('tactics-undo');
  const redoButton = document.getElementById('tactics-redo');
  const ns = 'http://www.w3.org/2000/svg';
  const arrowIds = { '#e4ed79': 'arrow-yellow', '#f3efe1': 'arrow-white', '#e45538': 'arrow-red', '#66c7ff': 'arrow-blue' };

  let state = load();
  let tool = 'select';
  let selectedId = null;
  let gesture = null;
  let undoStack = [];
  let redoStack = [];

  function emptyState() { return { nextId: 1, homeNumber: 1, awayNumber: 1, elements: [] }; }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && Array.isArray(saved.elements) ? saved : emptyState();
    } catch { return emptyState(); }
  }
  function snapshot() { return JSON.stringify(state); }
  function persist() { localStorage.setItem(STORAGE_KEY, snapshot()); }
  function commit(before) {
    if (before && before !== snapshot()) {
      undoStack.push(before);
      if (undoStack.length > 80) undoStack.shift();
      redoStack = [];
      persist();
    }
    render();
  }
  function restore(serialized) {
    state = JSON.parse(serialized);
    selectedId = null;
    persist();
    render();
  }
  function undo() {
    const previous = undoStack.pop();
    if (!previous) return;
    redoStack.push(snapshot());
    restore(previous);
    announce('Último cambio deshecho.');
  }
  function redo() {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(snapshot());
    restore(next);
    announce('Cambio rehecho.');
  }
  function announce(message) { status.textContent = message; }
  function svg(name, attrs = {}) {
    const node = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
  function point(event) {
    const client = new DOMPoint(event.clientX, event.clientY);
    return client.matrixTransform(board.getScreenCTM().inverse());
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function currentColor() { return document.querySelector('[name="tactic-color"]:checked').value; }
  function elementById(id) { return state.elements.find(item => item.id === Number(id)); }
  function nextId() { return state.nextId++; }

  function setTool(next) {
    tool = next;
    selectedId = null;
    document.querySelectorAll('.tactic-tool').forEach(button => {
      const active = button.dataset.tool === tool;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    board.dataset.tool = tool;
    render();
    announce(`${document.querySelector(`[data-tool="${tool}"]`).textContent.trim()} activado.`);
  }

  function addPiece(type, x, y) {
    const before = snapshot();
    const number = type === 'home' ? state.homeNumber++ : state.awayNumber++;
    state.elements.push({ id: nextId(), type, x: clamp(x, 35, 1015), y: clamp(y, 35, 645), number, label: '' });
    commit(before);
    announce(`${type === 'home' ? 'Jugador FC OGS' : 'Jugador rival'} ${number} añadido.`);
  }
  function addMarker(type, x, y) {
    const before = snapshot();
    state.elements.push({ id: nextId(), type, x: clamp(x, 25, 1025), y: clamp(y, 25, 655) });
    commit(before);
    announce(type === 'ball' ? 'Balón añadido.' : 'Cono añadido.');
  }
  function removeElement(id) {
    const before = snapshot();
    state.elements = state.elements.filter(item => item.id !== Number(id));
    selectedId = null;
    commit(before);
    announce('Elemento eliminado.');
  }

  function renderPath(item) {
    let node;
    if (item.type === 'line' || item.type === 'arrow') {
      node = svg('line', { x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2 });
      if (item.type === 'arrow') node.setAttribute('marker-end', `url(#${arrowIds[item.color] || 'arrow-yellow'})`);
    } else {
      node = svg('polyline', { points: item.points.map(value => value.join(',')).join(' '), fill: 'none' });
    }
    node.setAttribute('stroke', item.color);
    node.setAttribute('stroke-width', '6');
    node.setAttribute('stroke-linecap', 'round');
    node.setAttribute('stroke-linejoin', 'round');
    node.dataset.id = item.id;
    node.classList.toggle('is-selected', item.id === selectedId);
    drawingLayer.appendChild(node);
  }
  function renderPiece(item) {
    const group = svg('g', { transform: `translate(${item.x} ${item.y})`, tabindex: '0', role: 'button' });
    group.dataset.id = item.id;
    group.classList.add('tactic-object', `tactic-${item.type}`);
    group.classList.toggle('is-selected', item.id === selectedId);
    if (item.type === 'home' || item.type === 'away') {
      group.setAttribute('aria-label', `${item.type === 'home' ? 'FC OGS' : 'Rival'}, dorsal ${item.number}${item.label ? `, ${item.label}` : ''}`);
      group.append(svg('circle', { r: '27', fill: item.type === 'home' ? '#e4ed79' : '#e45538', stroke: '#f3efe1', 'stroke-width': '3' }));
      const number = svg('text', { y: '8', 'text-anchor': 'middle', fill: '#172f29', 'font-family': 'Barlow Condensed', 'font-size': '25', 'font-weight': '700' });
      number.textContent = item.number;
      group.append(number);
      if (item.label) {
        const label = svg('text', { y: '44', 'text-anchor': 'middle', fill: '#f3efe1', 'font-family': 'Barlow', 'font-size': '14', 'font-weight': '600', 'paint-order': 'stroke', stroke: '#172f29', 'stroke-width': '4' });
        label.textContent = item.label.slice(0, 16);
        group.append(label);
      }
    } else if (item.type === 'ball') {
      group.setAttribute('aria-label', 'Balón');
      group.append(svg('circle', { r: '16', fill: '#f3efe1', stroke: '#172f29', 'stroke-width': '3' }));
      group.append(svg('circle', { r: '5', fill: '#172f29' }));
    } else {
      group.setAttribute('aria-label', 'Cono');
      group.append(svg('path', { d: 'M0 -20L18 16H-18Z', fill: '#f08a3c', stroke: '#f3efe1', 'stroke-width': '2' }));
      group.append(svg('line', { x1: '-22', y1: '17', x2: '22', y2: '17', stroke: '#f3efe1', 'stroke-width': '4' }));
    }
    pieceLayer.appendChild(group);
  }
  function render() {
    drawingLayer.replaceChildren();
    pieceLayer.replaceChildren();
    state.elements.filter(item => ['line', 'arrow', 'freehand'].includes(item.type)).forEach(renderPath);
    state.elements.filter(item => !['line', 'arrow', 'freehand'].includes(item.type)).forEach(renderPiece);
    document.getElementById('home-count').textContent = state.elements.filter(item => item.type === 'home').length;
    document.getElementById('away-count').textContent = state.elements.filter(item => item.type === 'away').length;
    undoButton.disabled = !undoStack.length;
    redoButton.disabled = !redoStack.length;
  }

  function targetId(event) { return event.target.closest('[data-id]')?.dataset.id || null; }
  board.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const p = point(event);
    const id = targetId(event);
    if (tool === 'eraser') { if (id) removeElement(id); return; }
    if (tool === 'home' || tool === 'away') { addPiece(tool, p.x, p.y); return; }
    if (tool === 'ball' || tool === 'cone') { addMarker(tool, p.x, p.y); return; }
    if (tool === 'select') {
      selectedId = id ? Number(id) : null;
      const item = id && elementById(id);
      if (item && !['line', 'arrow', 'freehand'].includes(item.type)) {
        gesture = { mode: 'drag', id: item.id, before: snapshot(), dx: item.x - p.x, dy: item.y - p.y };
        board.setPointerCapture(event.pointerId);
      }
      render();
      return;
    }
    if (['line', 'arrow', 'freehand'].includes(tool)) {
      gesture = { mode: tool, before: snapshot(), start: p, points: [[p.x, p.y]] };
      board.setPointerCapture(event.pointerId);
    }
  });
  board.addEventListener('pointermove', event => {
    if (!gesture) return;
    const p = point(event);
    if (gesture.mode === 'drag') {
      const item = elementById(gesture.id);
      item.x = clamp(p.x + gesture.dx, 25, 1025);
      item.y = clamp(p.y + gesture.dy, 25, 655);
      render();
    } else {
      if (gesture.mode === 'freehand') {
        const last = gesture.points.at(-1);
        if (Math.hypot(p.x - last[0], p.y - last[1]) > 4) gesture.points.push([p.x, p.y]);
      }
      previewLayer.replaceChildren();
      const preview = gesture.mode === 'freehand'
        ? svg('polyline', { points: gesture.points.map(value => value.join(',')).join(' '), fill: 'none' })
        : svg('line', { x1: gesture.start.x, y1: gesture.start.y, x2: p.x, y2: p.y });
      preview.setAttribute('stroke', currentColor());
      preview.setAttribute('stroke-width', '6');
      preview.setAttribute('stroke-linecap', 'round');
      if (gesture.mode === 'arrow') preview.setAttribute('marker-end', `url(#${arrowIds[currentColor()]})`);
      previewLayer.append(preview);
    }
  });
  board.addEventListener('pointerup', event => {
    if (!gesture) return;
    const p = point(event);
    const current = gesture;
    gesture = null;
    previewLayer.replaceChildren();
    if (current.mode === 'drag') {
      commit(current.before);
      announce('Elemento recolocado.');
    } else if (current.mode === 'freehand' && current.points.length > 1) {
      state.elements.push({ id: nextId(), type: 'freehand', color: currentColor(), points: current.points });
      commit(current.before);
    } else if (Math.hypot(p.x - current.start.x, p.y - current.start.y) > 10) {
      state.elements.push({ id: nextId(), type: current.mode, color: currentColor(), x1: current.start.x, y1: current.start.y, x2: p.x, y2: p.y });
      commit(current.before);
    }
  });
  board.addEventListener('pointercancel', () => { gesture = null; previewLayer.replaceChildren(); render(); });
  board.addEventListener('dblclick', event => {
    const item = elementById(targetId(event));
    if (!item || !['home', 'away'].includes(item.type)) return;
    const label = prompt('Nombre o indicación del jugador:', item.label || '');
    if (label === null) return;
    const before = snapshot();
    item.label = label.trim().slice(0, 24);
    commit(before);
  });
  board.addEventListener('keydown', event => {
    const id = targetId(event);
    if (['Delete', 'Backspace'].includes(event.key) && id) { event.preventDefault(); removeElement(id); }
    if (event.key === 'Enter' && id) { selectedId = Number(id); setTool('select'); }
  });

  document.querySelectorAll('.tactic-tool').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)));
  undoButton.addEventListener('click', undo);
  redoButton.addEventListener('click', redo);
  document.getElementById('tactics-clear').addEventListener('click', () => {
    if (!state.elements.length || !confirm('¿Vaciar toda la pizarra táctica?')) return;
    const before = snapshot();
    state = emptyState();
    commit(before);
    announce('Pizarra vaciada.');
  });
  document.getElementById('tactics-export').addEventListener('click', async () => {
    const clone = board.cloneNode(true);
    clone.querySelector('#tactics-preview-layer')?.remove();
    clone.querySelectorAll('.is-selected').forEach(node => node.classList.remove('is-selected'));
    clone.setAttribute('width', '2100');
    clone.setAttribute('height', '1360');
    const source = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = 2100; canvas.height = 1360;
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const link = document.createElement('a');
      link.download = 'FC-OGS-jugada-tactica.png';
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      announce('Jugada guardada como PNG.');
    } catch { announce('No se pudo guardar la jugada.'); }
    finally { URL.revokeObjectURL(url); }
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    if (event.key === 'Escape') { selectedId = null; setTool('select'); }
    if (['Delete', 'Backspace'].includes(event.key) && selectedId && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) removeElement(selectedId);
  });

  setTool('select');
})();
