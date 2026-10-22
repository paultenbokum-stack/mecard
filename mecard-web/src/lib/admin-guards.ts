// When staff may delete or archive something, and what to unlink first.
// Pure, so the rules can be unit tested; the counts come from admin-manage.ts.

export type Guard = { ok: boolean; blockers: string[] };

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const guard = (blockers: (string | false)[]): Guard => {
  const b = blockers.filter((x): x is string => !!x);
  return { ok: !b.length, blockers: b };
};

/** Users have no archive: deleting removes the account. Anything with orders stays (order history). */
export function userDeleteGuard(c: { orders: number; profiles: number; companies: number; cards: number; isSelf: boolean }): Guard {
  return guard([
    c.isSelf && "You can't delete your own account.",
    c.orders > 0 && `${n(c.orders, "order")}: accounts with orders are kept for the order history.`,
    c.profiles > 0 && `${n(c.profiles, "live profile")} owned or managed: archive them or give them to someone else first.`,
    c.companies > 0 && `${n(c.companies, "company", "companies")} owned: delete them or give them to someone else first.`,
    c.cards > 0 && `${n(c.cards, "live tag")} owned: archive them or give them to someone else first.`,
  ]);
}

/** Companies have no archive: delete only an empty one. */
export function companyDeleteGuard(c: { profiles: number; cards: number }): Guard {
  return guard([
    c.profiles > 0 && `${n(c.profiles, "live profile")} in this company: move them to another company (or none) first.`,
    c.cards > 0 && `${n(c.cards, "live tag")} linked to this company: move or unlink them first.`,
  ]);
}

/** Profiles are archived, not deleted: their URL then shows "not found". */
export function profileArchiveGuard(c: { cards: number }): Guard {
  return guard([c.cards > 0 && `${n(c.cards, "live tag")} point at this profile: unassign or move them first, or their QR codes and chips lead nowhere.`]);
}

/** Tags are archived, not deleted (their printed address keeps resolving). */
export function cardArchiveGuard(c: { orderStatus: string | null; profileId: number | null }): Guard {
  return guard([
    !!c.orderStatus && !["cancelled", "refunded", "failed"].includes(c.orderStatus) && `It is on an order that is ${c.orderStatus}: cancel the order instead, or keep the tag.`,
    !!c.profileId && "It is assigned to a profile: unassign it first.",
  ]);
}
