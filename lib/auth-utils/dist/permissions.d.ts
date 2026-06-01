/**
 * Canonical permission catalog (RBAC).
 *
 * Single source of truth for every fine-grained capability used by the
 * backend middleware and the frontend gating hooks. Permission identifiers
 * are stable strings of the form `<domain>.<action>`. Never rename one
 * without a database migration that updates every `role_permissions` row.
 *
 * Used by:
 *   - api-server: requirePermission()/requireAnyPermission() middleware,
 *     permissions.service.ts seed, and JWT compaction.
 *   - admin/vendor/rider apps: useHasPermission()/usePermissions() hooks
 *     and Roles & Permissions admin page.
 */
export type PermissionCategory = "system" | "users" | "orders" | "finance" | "vendors" | "content" | "promotions" | "fleet" | "support" | "vendor_staff" | "rider_ops";
export interface PermissionDef {
    id: string;
    label: string;
    category: PermissionCategory;
    description?: string;
    /** High-risk permissions are flagged in the UI with a red badge. */
    highRisk?: boolean;
}
export declare const PERMISSIONS: readonly [{
    readonly id: "system.settings.view";
    readonly label: "View platform settings";
    readonly category: "system";
}, {
    readonly id: "system.settings.edit";
    readonly label: "Edit platform settings";
    readonly category: "system";
}, {
    readonly id: "system.secrets.manage";
    readonly label: "Manage secrets / integrations";
    readonly category: "system";
    readonly highRisk: true;
}, {
    readonly id: "system.roles.manage";
    readonly label: "Manage roles & permissions";
    readonly category: "system";
}, {
    readonly id: "system.audit.view";
    readonly label: "View audit log";
    readonly category: "system";
}, {
    readonly id: "system.maintenance";
    readonly label: "Toggle maintenance mode";
    readonly category: "system";
}, {
    readonly id: "system.sms.view";
    readonly label: "View SMS gateways";
    readonly category: "system";
}, {
    readonly id: "system.sms.manage";
    readonly label: "Create / edit / delete SMS gateways";
    readonly category: "system";
    readonly highRisk: true;
}, {
    readonly id: "system.whitelist.view";
    readonly label: "View OTP bypass whitelist";
    readonly category: "system";
}, {
    readonly id: "system.whitelist.manage";
    readonly label: "Add / edit / remove OTP bypass whitelist entries";
    readonly category: "system";
    readonly highRisk: true;
}, {
    readonly id: "users.view";
    readonly label: "View users";
    readonly category: "users";
}, {
    readonly id: "users.create";
    readonly label: "Create users";
    readonly category: "users";
}, {
    readonly id: "users.edit";
    readonly label: "Edit user profiles";
    readonly category: "users";
}, {
    readonly id: "users.delete";
    readonly label: "Delete users";
    readonly category: "users";
    readonly highRisk: true;
}, {
    readonly id: "users.ban";
    readonly label: "Ban / unban users";
    readonly category: "users";
}, {
    readonly id: "users.impersonate";
    readonly label: "Impersonate users";
    readonly category: "users";
    readonly highRisk: true;
}, {
    readonly id: "users.approve";
    readonly label: "Approve / reject pending accounts";
    readonly category: "users";
}, {
    readonly id: "users.wallet";
    readonly label: "Top-up / adjust user wallets";
    readonly category: "users";
}, {
    readonly id: "orders.view";
    readonly label: "View orders";
    readonly category: "orders";
}, {
    readonly id: "orders.create";
    readonly label: "Create orders manually";
    readonly category: "orders";
}, {
    readonly id: "orders.edit";
    readonly label: "Edit orders";
    readonly category: "orders";
}, {
    readonly id: "orders.cancel";
    readonly label: "Cancel orders";
    readonly category: "orders";
}, {
    readonly id: "orders.refund";
    readonly label: "Issue refunds";
    readonly category: "orders";
}, {
    readonly id: "orders.reassign";
    readonly label: "Reassign orders / riders";
    readonly category: "orders";
}, {
    readonly id: "finance.transactions.view";
    readonly label: "View wallet transactions";
    readonly category: "finance";
}, {
    readonly id: "finance.wallet.topup";
    readonly label: "Top-up user wallets";
    readonly category: "finance";
}, {
    readonly id: "finance.wallet.adjust";
    readonly label: "Adjust wallet balances";
    readonly category: "finance";
}, {
    readonly id: "finance.withdrawals.view";
    readonly label: "View withdrawal requests";
    readonly category: "finance";
}, {
    readonly id: "finance.withdrawals.approve";
    readonly label: "Approve withdrawals";
    readonly category: "finance";
    readonly highRisk: true;
}, {
    readonly id: "finance.payouts.release";
    readonly label: "Release vendor / rider payouts";
    readonly category: "finance";
    readonly highRisk: true;
}, {
    readonly id: "finance.deposits.review";
    readonly label: "Review deposit requests";
    readonly category: "finance";
}, {
    readonly id: "finance.kyc.view";
    readonly label: "View KYC submissions";
    readonly category: "finance";
}, {
    readonly id: "finance.kyc.approve";
    readonly label: "Approve KYC submissions";
    readonly category: "finance";
}, {
    readonly id: "vendors.view";
    readonly label: "View vendor accounts";
    readonly category: "vendors";
}, {
    readonly id: "vendors.edit";
    readonly label: "Edit vendor accounts";
    readonly category: "vendors";
}, {
    readonly id: "vendors.approve";
    readonly label: "Approve vendor accounts";
    readonly category: "vendors";
}, {
    readonly id: "vendors.suspend";
    readonly label: "Suspend vendor accounts";
    readonly category: "vendors";
}, {
    readonly id: "content.products.view";
    readonly label: "View products";
    readonly category: "content";
}, {
    readonly id: "content.products.edit";
    readonly label: "Edit products";
    readonly category: "content";
}, {
    readonly id: "content.products.delete";
    readonly label: "Delete products";
    readonly category: "content";
}, {
    readonly id: "content.categories.edit";
    readonly label: "Edit categories";
    readonly category: "content";
}, {
    readonly id: "content.banners.edit";
    readonly label: "Edit banners";
    readonly category: "content";
}, {
    readonly id: "promotions.view";
    readonly label: "View promotions";
    readonly category: "promotions";
}, {
    readonly id: "promotions.edit";
    readonly label: "Edit promotions / promo codes";
    readonly category: "promotions";
}, {
    readonly id: "promotions.publish";
    readonly label: "Publish promotions";
    readonly category: "promotions";
}, {
    readonly id: "promotions.flash.edit";
    readonly label: "Manage flash deals";
    readonly category: "promotions";
}, {
    readonly id: "fleet.rides.view";
    readonly label: "View rides";
    readonly category: "fleet";
}, {
    readonly id: "riders.approve";
    readonly label: "Approve / Reject Rider Applications";
    readonly category: "fleet";
}, {
    readonly id: "fleet.rides.dispatch";
    readonly label: "Dispatch rides / reassign drivers";
    readonly category: "fleet";
}, {
    readonly id: "fleet.rides.cancel";
    readonly label: "Cancel rides";
    readonly category: "fleet";
}, {
    readonly id: "fleet.parcel.view";
    readonly label: "View parcel bookings";
    readonly category: "fleet";
}, {
    readonly id: "fleet.parcel.dispatch";
    readonly label: "Dispatch parcels";
    readonly category: "fleet";
}, {
    readonly id: "fleet.pharmacy.view";
    readonly label: "View pharmacy orders";
    readonly category: "fleet";
}, {
    readonly id: "fleet.pharmacy.dispatch";
    readonly label: "Dispatch pharmacy orders";
    readonly category: "fleet";
}, {
    readonly id: "fleet.zones.view";
    readonly label: "View service zones";
    readonly category: "fleet";
}, {
    readonly id: "fleet.zones.manage";
    readonly label: "Create / edit / delete service zones";
    readonly category: "fleet";
}, {
    readonly id: "support.chat.view";
    readonly label: "View support chats";
    readonly category: "support";
}, {
    readonly id: "support.chat.respond";
    readonly label: "Respond to support chats";
    readonly category: "support";
}, {
    readonly id: "support.chat.edit";
    readonly label: "Edit support chat settings";
    readonly category: "support";
}, {
    readonly id: "support.broadcast.send";
    readonly label: "Send broadcast notifications";
    readonly category: "support";
}, {
    readonly id: "vendor_staff.prices.edit";
    readonly label: "Vendor: edit prices";
    readonly category: "vendor_staff";
}, {
    readonly id: "vendor_staff.products.edit";
    readonly label: "Vendor: edit products";
    readonly category: "vendor_staff";
}, {
    readonly id: "vendor_staff.orders.fulfill";
    readonly label: "Vendor: fulfill orders";
    readonly category: "vendor_staff";
}, {
    readonly id: "vendor_staff.staff.manage";
    readonly label: "Vendor: manage staff";
    readonly category: "vendor_staff";
}, {
    readonly id: "vendor_staff.payouts.view";
    readonly label: "Vendor: view payouts";
    readonly category: "vendor_staff";
}, {
    readonly id: "rider_ops.rides.dispatch";
    readonly label: "Rider: accept dispatched rides";
    readonly category: "rider_ops";
}, {
    readonly id: "rider_ops.parcel.handle";
    readonly label: "Rider: handle parcel deliveries";
    readonly category: "rider_ops";
}];
export type PermissionId = (typeof PERMISSIONS)[number]["id"];
export declare const PERMISSION_IDS: readonly PermissionId[];
/** Throws if the id is not in the catalog. */
export declare function assertPermissionId(id: string): asserts id is PermissionId;
export declare function isPermissionId(id: string): id is PermissionId;
/** Group permissions by category for UI rendering. */
export declare function permissionsByCategory(): Record<PermissionCategory, PermissionDef[]>;
/** Default permission sets for the seed roles. */
export declare const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly PermissionId[]>;
/** Stable ordering used to compact a permission set into a string array
 *  for token embedding. Keeps tokens deterministic for cache keys. */
export declare function compactPermissions(perms: Iterable<string>): string[];
/**
 * Returns true when `required` is present in the user's permission list.
 * Accepts either a raw string or a typed PermissionId — both work.
 */
export declare function hasPermission(userPerms: string[], required: string): boolean;
//# sourceMappingURL=permissions.d.ts.map