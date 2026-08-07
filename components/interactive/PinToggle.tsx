'use client';

import { useApply } from '@/components/interactive/useApply';

export default function PinToggle({ surfaceId, pinned }: { surfaceId: string; pinned: boolean }) {
  const { apply, busy } = useApply();

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => apply([{ op: 'pinSurface', surface: surfaceId, pinned: !pinned }])}
      title={pinned ? 'Unpin — remove from the top of Home' : 'Pin to the top of Home'}
      aria-label={pinned ? 'Unpin' : 'Pin'}
      className={`text-xl leading-none disabled:opacity-50 ${pinned ? 'text-accent' : 'text-faint hover:text-ink'}`}
    >
      {pinned ? '★' : '☆'}
    </button>
  );
}
