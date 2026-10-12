export type Role = "admin" | "staff" | "rider" | "customer";

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", staff: "Staff", rider: "Rider", customer: "Customer" };

/** Where each role lands after logging in. Riders only get the driver handheld, customers the online store. */
export const homeFor = (role: Role) => (role === "rider" ? "/driver" : role === "customer" ? "/shop" : "/");

/** Screens staff never open: the owner's sales report, and the rider handheld (dispatch works from Delivery). */
const STAFF_BLOCKED = ["/sales", "/driver"];

/** Store pages that act as a customer. The team browses the store but orders through the POS. */
const CUSTOMER_ONLY = ["/shop/checkout", "/shop/orders"];

/**
 * What each role may open (spec 10.3, 10.4). Admin is the owner and sees every staff screen. Staff run the
 * counter, warehouse, production and dispatch. Riders only get the driver handheld. Customers only get the
 * online store. Anyone, logged in or not, can see the contact page and browse the store's catalogue.
 */
export function canOpen(role: Role | undefined, path: string) {
  const under = (p: string) => path === p || path.startsWith(`${p}/`);
  if (under("/contact")) return true;
  // Logged out, / is the landing page (spec 11.9).
  if (!role) return path === "/" || under("/login") || path === "/shop";
  if (role === "rider") return under("/driver");
  if (role === "customer") return under("/shop");
  if (CUSTOMER_ONLY.some(under)) return false;
  if (role === "staff") return !STAFF_BLOCKED.some(under);
  return true;
}
