import SurfaceCard from '@/components/SurfaceCard';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Library · Otto' };

/**
 * Every surface, always in creation order, so spatial memory works — a
 * surface never moves in this grid. Browse, don't organize.
 */
export default async function LibraryPage() {
  const store = await getStore();
  const surfaces = await store.listSurfaces();
  const counts = await Promise.all(
    surfaces.map(async (surface) => (await store.listRecords(surface.id)).length),
  );

  if (surfaces.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-faint">
        Nothing here yet — tell Otto what you&apos;re juggling below.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {surfaces.map((surface, index) => (
        <SurfaceCard key={surface.id} surface={surface} recordCount={counts[index]} />
      ))}
    </div>
  );
}
