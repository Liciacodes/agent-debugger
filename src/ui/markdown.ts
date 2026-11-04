// The two bits of Markdown models use most, **bold** and `code`, as pieces the
// UI can style. Everything else stays exactly as written. The pieces are only
// text, never HTML, so React escapes them and an answer can't add markup.
export type MarkdownPiece =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "bold"; children: MarkdownPiece[] };

// A line that opens or closes a code block, like ```ts. What's inside a code
// block is code, so `x**2 + y**2` there must not turn bold.
const FENCE = /^\s*(```|~~~)/;

// Joins text onto the piece before it, so "a", "b" become one "ab".
function addText(pieces: MarkdownPiece[], text: string): void {
  const last = pieces[pieces.length - 1];
  if (last?.type === "text") last.text += text;
  else pieces.push({ type: "text", text });
}

// How many backticks in a row start at `start`.
function tickCount(line: string, start: number): number {
  let end = start;
  while (line[end] === "`") end++;
  return end - start;
}

// Where the backticks that close a code span start: the next run of exactly
// the same length, so ``a`b`` can hold a single backtick. -1 if there's none.
function closingTicks(line: string, from: number, count: number): number {
  for (let i = from; i < line.length; ) {
    if (line[i] !== "`") {
      i++;
      continue;
    }
    const run = tickCount(line, i);
    if (run === count) return i;
    i += run;
  }
  return -1;
}

// Markdown drops one space on each side, so `` `a` `` shows as `a`.
function codeText(inside: string): string {
  const padded = inside.length >= 2 && inside.startsWith(" ") && inside.endsWith(" ");
  return padded && inside.trim() !== "" ? inside.slice(1, -1) : inside;
}

// Where the ** that closes a bold part starts, or -1. It must follow a
// non-space character, and ** inside a code span doesn't count.
function closingBold(line: string, from: number): number {
  for (let i = from; i < line.length; ) {
    if (line[i] === "`") {
      const ticks = tickCount(line, i);
      const end = closingTicks(line, i + ticks, ticks);
      i = end === -1 ? i + ticks : end + ticks;
      continue;
    }
    if (i > from && line.startsWith("**", i) && !/\s/.test(line[i - 1])) return i;
    i++;
  }
  return -1;
}

// Bold and code never run past the end of a line, so a stray ** can't make
// the rest of the answer bold.
function parseLine(line: string): MarkdownPiece[] {
  const pieces: MarkdownPiece[] = [];

  for (let i = 0; i < line.length; ) {
    if (line[i] === "`") {
      const ticks = tickCount(line, i);
      const end = closingTicks(line, i + ticks, ticks);
      if (end === -1) {
        addText(pieces, line.slice(i, i + ticks));
      } else {
        pieces.push({ type: "code", text: codeText(line.slice(i + ticks, end)) });
      }
      i = end === -1 ? i + ticks : end + ticks;
      continue;
    }

    // "** like this" isn't bold: the opening ** must touch the text.
    if (line.startsWith("**", i) && i + 2 < line.length && !/\s/.test(line[i + 2])) {
      const end = closingBold(line, i + 2);
      if (end !== -1) {
        pieces.push({ type: "bold", children: parseLine(line.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    addText(pieces, line[i]);
    i++;
  }

  return pieces;
}

export function parseMarkdown(text: string): MarkdownPiece[] {
  const pieces: MarkdownPiece[] = [];
  let inCodeBlock = false;

  text.split("\n").forEach((line, index) => {
    if (index > 0) addText(pieces, "\n");

    if (FENCE.test(line)) inCodeBlock = !inCodeBlock;
    if (FENCE.test(line) || inCodeBlock) {
      addText(pieces, line);
      return;
    }

    for (const piece of parseLine(line)) {
      if (piece.type === "text") addText(pieces, piece.text);
      else pieces.push(piece);
    }
  });

  return pieces;
}
