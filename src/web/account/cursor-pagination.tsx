import { Link } from "@cloudflare/kumo/components/link";
import { Pagination } from "@cloudflare/kumo/components/pagination";
import { useCallback } from "react";

import { navigateWorkspace } from "./account-navigation";

// The API has a forward cursor and a restart URL, not a total or a previous cursor.
export function CursorPagination({
  count,
  next,
  first,
  noun = "registros",
  singular = "registro",
}: {
  count: number;
  next: string | null;
  first: string | null;
  noun?: string;
  singular?: string;
}) {
  const advance = useCallback(
    (page: number) => {
      if (page > 1 && next) {
        navigateWorkspace(new URL(next, location.origin));
      }
    },
    [next],
  );
  if (!(count || first || next)) {
    return null;
  }
  const label = count === 1 ? singular : noun;
  return (
    <div className="pagination">
      {count > 0 && (
        <span>
          {count} {label} nesta página
        </span>
      )}
      {!!first && <Link href={first}>Voltar ao início</Link>}
      {!!next && (
        <Pagination
          className="w-auto"
          hasNextPage={!!next}
          labels={{
            navigation: "Paginação por cursor",
            nextPage: "Próximos registros",
            previousPage: "Página anterior indisponível; use Voltar ao início",
          }}
          setPage={advance}
        >
          <Pagination.Controls controls="simple" />
        </Pagination>
      )}
    </div>
  );
}
