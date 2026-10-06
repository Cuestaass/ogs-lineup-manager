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

export async function extractPdfRecords(file) {
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

export function groupPdfRows(records) {
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

export function normalizePlayerName(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
  }

