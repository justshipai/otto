/**
 * Tinted pill for status/select values. The tint is picked by generic
 * keyword tone (done-ish → green, stuck-ish → red, moving-ish → amber),
 * falling back to neutral — wording heuristics, not vertical knowledge.
 */
const GOOD = /\b(paid|done|complete|completed|posted|published|booked|hired|won|accepted|moved)\b/i;
const BAD = /\b(overdue|blocked|late|stuck|lost|rejected|failed|cancelled|canceled)\b/i;
const ACTIVE = /\b(sent|in progress|drafting|scheduled|applied|waiting|interview|pending|to apply)\b/i;

const TONES = {
  good: 'bg-green-100 text-green-800',
  bad: 'bg-red-100 text-red-700',
  active: 'bg-attention-bg text-attention-ink',
  neutral: 'bg-cream text-faint',
} as const;

function tone(label: string): keyof typeof TONES {
  if (BAD.test(label)) return 'bad';
  if (GOOD.test(label)) return 'good';
  if (ACTIVE.test(label)) return 'active';
  return 'neutral';
}

export default function StatusPill({ label }: { label: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone(label)]}`}
    >
      {label}
    </span>
  );
}
