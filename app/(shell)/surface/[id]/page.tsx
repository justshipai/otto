import Link from 'next/link';
import { notFound } from 'next/navigation';
import SurfaceView from '@/components/surface-views/SurfaceView';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function SurfacePage({ params }: PageProps<'/surface/[id]'>) {
  const { id } = await params;
  const store = await getStore();
  const surface = await store.getSurface(id);
  if (!surface) {
    notFound();
  }
  const records = await store.listRecords(surface.id);

  return (
    <div>
      <Link href="/" className="text-sm text-faint hover:text-ink">
        ← Home
      </Link>
      <div className="flex items-center gap-3 pt-4 pb-5">
        <span className="flex size-11 items-center justify-center rounded-xl bg-card text-xl">
          {surface.icon}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{surface.title}</h1>
        {surface.pinned && (
          <span className="text-faint" title="Pinned" aria-label="Pinned">
            ★
          </span>
        )}
      </div>
      <SurfaceView surface={surface} records={records} />
      <p className="pt-4 text-xs text-faint">
        {records.length} {records.length === 1 ? 'item' : 'items'}
      </p>
    </div>
  );
}
