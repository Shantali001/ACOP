import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Download, Maximize2, Minimize2, MoreHorizontal } from 'lucide-react';
import { exportChartAsCSV, exportChartAsPNG, exportChartAsPDF, getChartFilename } from '../utils/chartExport';

type ChartContainerProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  csvData?: Record<string, unknown>[];
  chartId?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  actions?: ReactNode;
};

export function ChartContainer({
  title,
  description,
  children,
  className = '',
  csvData,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data available.',
  actions,
}: ChartContainerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExportPNG = useCallback(() => {
    const el = chartRef.current?.querySelector('.recharts-wrapper') as HTMLElement | null;
    exportChartAsPNG(el, getChartFilename(title));
    setShowMenu(false);
  }, [title]);

  const handleExportPDF = useCallback(() => {
    const el = chartRef.current?.querySelector('.recharts-wrapper') as HTMLElement | null;
    exportChartAsPDF(el, getChartFilename(title));
    setShowMenu(false);
  }, [title]);

  const handleExportCSV = useCallback(() => {
    if (csvData) {
      exportChartAsCSV(csvData, getChartFilename(title));
    }
    setShowMenu(false);
  }, [csvData, title]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  return (
    <div
      ref={chartRef}
      className={`card ${className} ${isFullscreen ? 'fixed inset-4 z-50 overflow-auto' : ''}`}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-card font-semibold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-hover hover:text-ink"
              title="Export options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded-xl border border-border bg-surface shadow-elevated">
                <button
                  type="button"
                  onClick={handleExportPNG}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink transition hover:bg-hover"
                >
                  <Download className="h-4 w-4" />
                  Export as PNG
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink transition hover:bg-hover"
                >
                  <Download className="h-4 w-4" />
                  Export as PDF
                </button>
                {csvData && (
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink transition hover:bg-hover"
                  >
                    <Download className="h-4 w-4" />
                    Export as CSV
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-hover hover:text-ink"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="px-5 py-5">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="skeleton h-4 w-32" />
            </div>
          </div>
        ) : isEmpty ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-ink-muted">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

