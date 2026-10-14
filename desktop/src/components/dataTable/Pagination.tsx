import { type Dispatch, type SetStateAction } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

/**
 * Botones de página (primera/última/vecinas). El padre calcula `pageButtons` y
 * es dueño del índice; aquí solo lo mutamos con los mismos actualizadores
 * funcionales que el original para no cambiar el comportamiento en estados
 * transitorios (índice > última página tras encoger los datos).
 */
export function Pagination({
  safePageIndex,
  totalPages,
  pageButtons,
  setPageIndex,
  prevAria,
  nextAria,
}: {
  safePageIndex: number;
  totalPages: number;
  pageButtons: number[];
  setPageIndex: Dispatch<SetStateAction<number>>;
  prevAria: string;
  nextAria: string;
}) {
  return (
    <div className="join">
      <button
        type="button"
        className="join-item btn btn-sm text-base-content dark:text-white"
        disabled={safePageIndex === 0}
        onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
        aria-label={prevAria}
      >
        <ChevronLeftIcon />
      </button>
      {pageButtons.map((page) => (
        <button
          key={page}
          type="button"
          className={`join-item btn btn-sm ${page === safePageIndex + 1 ? "btn-primary text-white" : "btn-ghost text-base-content dark:text-white"}`}
          onClick={() => setPageIndex(page - 1)}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        className="join-item btn btn-sm text-base-content dark:text-white"
        disabled={safePageIndex >= totalPages - 1}
        onClick={() => setPageIndex((page) => Math.min(totalPages - 1, page + 1))}
        aria-label={nextAria}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
