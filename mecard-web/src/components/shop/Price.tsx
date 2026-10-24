import { rands } from "@/lib/money";

/** A product price, with the regular price struck through when it is on sale. */
export function Price({ cents, regular }: { cents: number; regular: number | null }) {
  return (
    <span className="shop-price">
      {regular && regular > cents ? <del>{rands(regular)}</del> : null}
      {rands(cents)}
    </span>
  );
}
