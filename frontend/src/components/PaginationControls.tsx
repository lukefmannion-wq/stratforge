interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  itemCount: number;
  onPageChange: (page: number) => void;
}

export default function PaginationControls({
  page,
  pageSize,
  total,
  totalPages,
  itemCount,
  onPageChange,
}: PaginationControlsProps) {
  const showingStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingEnd = total === 0 ? 0 : Math.min((page - 1) * pageSize + itemCount, total);

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-500">
        Showing {showingStart}-{showingEnd} of {total}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-zinc-500">
          Page {totalPages === 0 ? 0 : page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}