'use client';

import { useRef, useState } from 'react';
import StatusPill from '@/components/surface-views/StatusPill';
import { useApply } from '@/components/interactive/useApply';

/**
 * A status pill that opens a styled menu of the field's options. The menu
 * uses the native Popover API: it renders in the browser's top layer (so
 * overflow-scrolled tables and board columns can't clip it) and gets
 * light-dismiss and Escape handling for free. Choosing an option is an
 * ordinary updateRecord operation — validated, logged, undoable.
 */
export default function StatusSelect({
  recordId,
  fieldKey,
  value,
  options,
}: {
  recordId: string;
  fieldKey: string;
  value: string | null;
  options: string[];
}) {
  const { apply } = useApply();
  const [pending, setPending] = useState<string | undefined>();
  const [lastValue, setLastValue] = useState(value);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // drop the optimistic value once the server confirms (value prop changes)
  if (value !== lastValue) {
    setLastValue(value);
    setPending(undefined);
  }

  const shown = pending ?? value;

  function openMenu() {
    const menu = menuRef.current;
    const button = buttonRef.current;
    if (!menu || !button) {
      return;
    }
    // popovers live in the top layer, outside any scroll container, so they
    // position against the viewport; align to the pill, flipping up when
    // there's no room below
    const rect = button.getBoundingClientRect();
    const estimatedHeight = options.length * 34 + 10;
    menu.style.left = 'auto';
    menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    if (rect.bottom + estimatedHeight + 8 > window.innerHeight) {
      menu.style.top = 'auto';
      menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
      menu.style.bottom = 'auto';
      menu.style.top = `${rect.bottom + 6}px`;
    }
    menu.showPopover();
  }

  async function choose(next: string) {
    menuRef.current?.hidePopover();
    if (next === shown) {
      return;
    }
    setPending(next);
    const ok = await apply([{ op: 'updateRecord', recordId, values: { [fieldKey]: next } }]);
    if (!ok) {
      setPending(undefined);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change status"
        className="cursor-pointer rounded-full transition-transform hover:scale-105"
      >
        <StatusPill label={shown ?? '—'} />
      </button>
      <div
        ref={menuRef}
        popover="auto"
        role="menu"
        onToggle={(e) => setOpen((e.nativeEvent as ToggleEvent).newState === 'open')}
        className="fixed m-0 min-w-36 rounded-xl border border-line bg-card p-1 shadow-lg shadow-ink/5"
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="menuitem"
            onClick={() => choose(option)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-cream"
          >
            <span className={`w-3.5 font-semibold text-accent ${option === shown ? '' : 'invisible'}`}>
              ✓
            </span>
            {option}
          </button>
        ))}
      </div>
    </>
  );
}
