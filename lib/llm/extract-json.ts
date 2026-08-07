/**
 * Pull a JSON operation array out of imperfect model output. Text-only
 * models routinely wrap JSON in code fences or a sentence of prose, and
 * some return { "operations": [...] } despite being asked for a bare
 * array — all of that is tolerated here. What is NOT tolerated is invalid
 * content: this only locates and parses JSON, and everything it returns
 * still goes through zod validation afterwards.
 *
 * Returns undefined when no parseable JSON array is found.
 */
export function extractJsonArray(text: string): unknown[] | undefined {
  const candidates: string[] = [];

  // fenced blocks first — they're the clearest signal of intent
  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
    candidates.push(match[1].trim());
  }
  candidates.push(text.trim());

  // widest bracketed span, for JSON embedded in prose
  const firstBracket = text.search(/[[{]/);
  const lastArrayEnd = text.lastIndexOf(']');
  const lastObjectEnd = text.lastIndexOf('}');
  if (firstBracket !== -1 && Math.max(lastArrayEnd, lastObjectEnd) > firstBracket) {
    candidates.push(text.slice(firstBracket, Math.max(lastArrayEnd, lastObjectEnd) + 1).trim());
  }

  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      const operations = (parsed as { operations?: unknown }).operations;
      if (Array.isArray(operations)) {
        return operations;
      }
      // a single bare operation object
      if ('op' in parsed) {
        return [parsed];
      }
    }
  }
  return undefined;
}
