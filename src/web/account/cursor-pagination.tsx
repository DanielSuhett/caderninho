import { Link } from "@cloudflare/kumo/components/link";
import { Pagination } from "@cloudflare/kumo/components/pagination";
import { useCallback } from "react";

import { navigateWorkspace } from "./account-navigation";

// The API has a forward cursor and a restart URL, not a total or a previous cursor.
export function CursorPagination({
  next,
  first,
}: {
  next: string | null;
  first: string | null;
}) {
  const advance = useCallback(
    (page: number) => {
      if (page > 1 && next) {
        navigateWorkspace(new URL(next, location.origin));
      }
    },
    [next],
  );
  if (!(first || next)) {
    return null;
  }
  return (
    <div className="pagination">
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
