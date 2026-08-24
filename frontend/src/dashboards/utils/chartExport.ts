/**
 * Utility functions for exporting charts as PNG, PDF, or CSV.
 */

export function exportChartAsPNG(chartElement: HTMLElement | null, filename: string): void {
  if (!chartElement) return;
  import('html2canvas').then((html2canvas) => {
    html2canvas.default(chartElement).then((canvas) => {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }).catch(() => {
    // Fallback: use a simpler approach
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const rect = chartElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(filename, 16, 32);
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  });
}

export function exportChartAsPDF(chartElement: HTMLElement | null, filename: string): void {
  if (!chartElement) return;
  import('jspdf').then(({ default: jsPDF }) => {
    import('html2canvas').then((html2canvas) => {
      html2canvas.default(chartElement).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4');
        const imgWidth = 280;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
        pdf.save(`${filename}.pdf`);
      });
    });
  }).catch(() => {
    // Simpler fallback - just print
    window.print();
  });
}

export function exportChartAsCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        const str = String(value ?? '');
        // Escape commas and quotes
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','),
    ),
  ];

  const csv = csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function getChartFilename(prefix: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}_${date}`.replace(/\s+/g, '_').toLowerCase();
}

