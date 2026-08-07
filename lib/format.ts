import type { Field, FieldValue } from '@/lib/core/types';

/** Display formatting for field values — generic per field TYPE, never per vertical. */
export function formatFieldValue(field: Field, value: FieldValue | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  switch (field.type) {
    case 'money':
      return typeof value === 'number' ? `$${value.toLocaleString('en-US')}` : String(value);
    case 'date':
      return formatDate(String(value));
    default:
      return String(value);
  }
}

export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== new Date().getFullYear()) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString('en-US', options);
}

/** The field that best names a record: the first text field, else the first field. */
export function primaryField(fields: Field[]): Field {
  return fields.find((f) => f.type === 'text') ?? fields[0];
}

/** The field board columns and pills key off: the first status field, else the first select. */
export function statusField(fields: Field[]): Field | undefined {
  return fields.find((f) => f.type === 'status') ?? fields.find((f) => f.type === 'select');
}
