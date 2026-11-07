// The admin screens a salesperson may open. src/proxy.ts enforces this for every
// /admin/ request; each of these pages then shows them only their own records.

export const SALES_LANDING = "/admin/commissions/";

export const salesMayOpen = (pathname: string) => /^\/admin\/(quotes|commissions)(\/|$)/.test(pathname);
