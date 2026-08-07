import BoardView from '@/components/surface-views/BoardView';
import ListView from '@/components/surface-views/ListView';
import TableView from '@/components/surface-views/TableView';
import type { Surface, SurfaceRecord } from '@/lib/core/types';

/**
 * The fixed renderer at the heart of Otto's no-code-generation rule: every
 * surface, whatever the model configured, is drawn by one of these three
 * human-written views. Models choose config; humans wrote everything that
 * can execute.
 */
export default function SurfaceView({ surface, records }: { surface: Surface; records: SurfaceRecord[] }) {
  switch (surface.viewType) {
    case 'board':
      return <BoardView surface={surface} records={records} />;
    case 'list':
      return <ListView surface={surface} records={records} />;
    case 'table':
      return <TableView surface={surface} records={records} />;
  }
}
