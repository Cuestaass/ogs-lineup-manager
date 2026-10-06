import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const pdfWriter = source.slice(source.indexOf('  function buildPdf('), source.indexOf('  function handleRosterFile('));

test('el PDF conserva los bytes de las imágenes y los offsets de todas sus páginas', async () => {
  const context = { Blob, Uint8Array, atob };
  runInNewContext(`${pdfWriter}\nglobalThis.writePdf = buildPdf;`, context);
  // Binary payload exercises non-ASCII bytes; rendering is verified in Chrome/PDFKit.
  const jpeg = Buffer.from([0xff, 0xd8, 0x00, 0x80, 0xfe, 0xff, 0xd9]);
  const sheet = { width: 1800, height: 1273, toDataURL: () => `data:image/jpeg;base64,${jpeg.toString('base64')}` };
  const result = context.writePdf([sheet, sheet, sheet]);
  const bytes = Buffer.from(await result.arrayBuffer());
  const pdf = bytes.toString('latin1');
  assert.equal(result.type, 'application/pdf');
  assert.match(pdf, /\/Count 3 \/Kids \[3 0 R 6 0 R 9 0 R\]/);
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xref, xref + 4), 'xref');
  const offsets = [...pdf.matchAll(/(\d{10}) 00000 n/g)];
  assert.equal(offsets.length, 11);
  offsets.forEach((match, index) => assert(pdf.slice(Number(match[1])).startsWith(`${index + 1} 0 obj\n`)));
  const images = [...pdf.matchAll(/\/DCTDecode \/Length (\d+) >>\nstream\n/g)];
  assert.equal(images.length, 3);
  for (const match of images) {
    const start = match.index + match[0].length;
    assert.deepEqual(bytes.subarray(start, start + Number(match[1])), jpeg);
  }
});
