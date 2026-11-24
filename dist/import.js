// Clipboard formats share the same rectangular table and coordinate normalization.
function readDelimited(text, delimiter) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && (quoted || value === '')) {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (ch === delimiter || ch === '\n')) {
      row.push(value); value = '';
      if (ch === '\n') { rows.push(row); row = []; }
    } else value += ch;
  }
  if (quoted) throw Error('引用符が閉じていません。元のセル範囲をコピーして貼り付けてください。');
  row.push(value); rows.push(row);
  return rows;
}

function markdownRow(line) {
  return line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell =>
    cell.trim().replace(/\\\|/g, '|').replace(/<br\s*\/?\s*>/gi, '\n').trim()
  );
}

function columnIndex(name) {
  return [...name].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
}

function readTable(input) {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n$/, '');
  if (!text.trim()) throw Error('表を貼り付けてください。');
  const lines = text.split('\n');
  const markdown = !text.includes('\t') && lines[1]?.includes('|') &&
    markdownRow(lines[1]).every(cell => /^:?-{2,}:?$/.test(cell));
  let table = markdown ? lines.filter((line, i) => i !== 1 && line.trim()).map(markdownRow)
    : readDelimited(text, text.includes('\t') ? '\t' : lines[0].includes(',') ? ',' : '\t');
  let left = 0, top = 1;
  const axis = table[0].map(c => c.trim().replace(/^<br\s*\/?\s*>/i, '').trim());
  const letters = axis.filter(Boolean);
  const hasAxis = table.length > 2 && letters.length >= 2 &&
    letters.every((v,i) => /^[A-Z]{1,3}$/.test(v) && (!i || columnIndex(v) === columnIndex(letters[i-1])+1)) &&
    axis.slice(axis.indexOf(letters[0]),axis.indexOf(letters[0])+letters.length).every(Boolean);
  if (hasAxis) table = table.slice(1);
  const firstNumber = Number(table[1]?.[0]);
  const numbered = table[0].length > 1 && !table[0][0].trim() &&
    Number.isSafeInteger(firstNumber) && firstNumber >= 2 &&
    table.slice(1).every((row,i) => row[0]?.trim() === String(firstNumber+i));
  if (hasAxis) {
    const start = axis.indexOf(letters[0]);
    // Some Markdown exports shift the letters left and pad the last axis cell.
    const alignedStart = numbered ? Math.max(0, start - 1) : start;
    left = Math.max(0, columnIndex(letters[0]) - alignedStart);
  }
  if (numbered) {
    top = firstNumber - 1;
    table = table.map(row => row.slice(1));
  }
  const width = table.reduce((max,r) => Math.max(max,r.length),0);
  if (!width || !table.some(r => r.some(v=>v.trim()))) throw Error('値の入った表を貼り付けてください。');
  const rows = table.map((r,i) => Array.from({length:width},(_,j) => r[j] ?? ''));
  return {rows,left,top};
}
