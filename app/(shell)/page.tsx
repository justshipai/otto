import Link from 'next/link';
import SurfaceCard from '@/components/SurfaceCard';
import { getAttentionItems } from '@/lib/attention';
import { getStore } from '@/lib/store';
import type { Surface, SurfaceRecord } from '@/lib/core/types';

export const dynamic = 'force-dynamic';

function SectionLabel({ children, tone = 'faint' }: { children: React.ReactNode; tone?: 'faint' | 'attention' }) {
  return (
    <h2
      className={`pb-2.5 text-xs font-bold tracking-[0.15em] uppercase ${tone === 'attention' ? 'text-attention-ink' : 'text-faint'}`}
    >
      {children}
    </h2>
  );
}

/**
 * Home is self-reordering: whatever needs the user floats to the top,
 * then pinned surfaces, then the rest, newest first. No folders, no
 * manual organizing.
 */
export default async function Home() {
  const store = await getStore();
  const surfaces = await store.listSurfaces();
  const attention = await getAttentionItems(store);

  const counts = new Map<string, SurfaceRecord[]>();
  await Promise.all(
    surfaces.map(async (surface) => {
      counts.set(surface.id, await store.listRecords(surface.id));
    }),
  );
  const records = (surface: Surface) => counts.get(surface.id) ?? [];

  const pinned = surfaces.filter((s) => s.pinned);
  const recent = surfaces
    .filter((s) => !s.pinned)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-8">
      {attention.length > 0 && (
        <section>
          <SectionLabel tone="attention">Needs attention</SectionLabel>
          <div className="flex flex-col gap-3">
            {attention.map((item) => (
              <div
                key={item.automation.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-attention-line bg-attention-bg px-4 py-3"
              >
                <p className="text-sm font-medium text-attention-ink">{item.message}</p>
                <Link
                  href={`/surface/${item.surface.id}`}
                  className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-deep"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {pinned.length > 0 && (
        <section>
          <SectionLabel>Pinned</SectionLabel>
          <div className="flex flex-col gap-3">
            {pinned.map((surface) => (
              <SurfaceCard
                key={surface.id}
                surface={surface}
                recordCount={records(surface).length}
                preview={records(surface)}
              />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <SectionLabel>Recent</SectionLabel>
          <div className="flex flex-col gap-3">
            {recent.map((surface) => (
              <SurfaceCard key={surface.id} surface={surface} recordCount={records(surface).length} />
            ))}
          </div>
        </section>
      )}

      {surfaces.length === 0 && (
        <p className="py-10 text-center text-sm text-faint">
          Nothing here yet — tell Otto what you&apos;re juggling below.
        </p>
      )}
    </div>
  );
}
