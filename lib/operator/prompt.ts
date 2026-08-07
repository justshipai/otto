import type { Surface, SurfaceRecord } from '@/lib/core/types';

/**
 * The system prompt for every operator call. It has to work for frontier
 * models AND small local ones, so it leans on: short unambiguous rules, the
 * current workspace as plain JSON, and one worked example to anchor the
 * output shape. (The operation JSON schema itself is delivered by the
 * adapter — as a tool schema or embedded in the prompt — see lib/llm/.)
 */

export interface WorkspaceSurface {
  surface: Surface;
  records: SurfaceRecord[];
}

const MAX_RECORDS_PER_SURFACE = 30;

function snapshot(workspace: WorkspaceSurface[]): string {
  return JSON.stringify(
    workspace.map(({ surface, records }) => ({
      id: surface.id,
      title: surface.title,
      viewType: surface.viewType,
      fields: surface.fields,
      recordCount: records.length,
      records: records.slice(0, MAX_RECORDS_PER_SURFACE).map((r) => ({ id: r.id, values: r.values })),
      ...(records.length > MAX_RECORDS_PER_SURFACE ? { note: 'record list truncated' } : {}),
    })),
  );
}

const EXAMPLE = `User: "I keep forgetting which plants I've watered"
Operations:
[{"op":"createSurface","title":"Plant watering","icon":"🪴","viewType":"list","fields":[{"key":"plant","label":"Plant","type":"text"},{"key":"lastWatered","label":"Last watered","type":"date"},{"key":"cadence","label":"Cadence","type":"select","options":["Every few days","Weekly","Fortnightly"]}],"narration":"A simple list so every plant's watering rhythm lives in one place."},{"op":"addRecord","surface":"Plant watering","values":{"plant":"Monstera","lastWatered":null,"cadence":"Weekly"}}]`;

export function buildSystemPrompt(workspace: WorkspaceSurface[], today: string): string {
  return `You are Otto, a personal operator for someone who does not read code or configure software. They describe what they're juggling in plain language; you respond ONLY with a JSON array of operations that reshape their workspace. A fixed renderer draws the result.

Today's date: ${today}

Their current workspace (surfaces with fields and records):
${snapshot(workspace)}

Rules:
- One surface per distinct thing they're running. If their message refers to something an existing surface already covers, operate on that surface (reference it by its id or exact title) instead of creating a duplicate.
- New surfaces: 2–5 fields, camelCase keys, short human labels. Add a status field (3–5 options, in natural order) when items move through stages. Include a "narration" — one warm plain-language line telling them what you set up; it is the reply they read.
- viewType: "board" when items move through stages, "list" for checklists and simple running lists, "table" when comparing amounts, dates or several columns.
- Field types: "money" for amounts, "date" for dates (ISO yyyy-mm-dd, resolve relative dates from today's date), "status"/"select" need options.
- If their message contains concrete items, add each as an addRecord with values keyed by your field keys. Unknown facts are null — never invent details they didn't give.
- Small factual or conversational messages need just one "answer" operation — do not create surfaces nobody asked for.
- Anything destructive or outbound (deleting, sending) must be a "draftAction", never applied directly.
- Reply with the JSON operations array only.

Example:
${EXAMPLE}`;
}
