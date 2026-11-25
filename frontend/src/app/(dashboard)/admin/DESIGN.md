# STITCHGRID Admin Panel Design

## Purpose
A calm B2B sourcing and factory-operations administration workspace. Help administrators review platform health, manage buyers and suppliers, verify organizations, moderate marketplace listings, and oversee RFQs, orders, payments, and support. Put the next required action and its current state before decoration.

## Visual direction
- Preserve the STITCHGRID logo and branded violet (#5B13EC) as the **single interactive accent**.
- Use a light, cool-gray canvas (#F6F7FA), white task surfaces, ink (#182332), and legible secondary text (#48586C).
- Use neutral borders (#E2E6ED). Reserve state colors for genuine success, warning, error, verification, and order/payment statuses; never use color as the only status signal.
- Use a clean system sans-serif. Page titles 22–24px, section titles 18–20px, body 14–16px, labels 12–13px. Avoid excessive bold; 700 is enough for headings.
- Use consistent desktop spacing based on 4/8/12/16/24/32px. Cards use restrained rounded corners (12–16px); controls use 10–12px radii.
- Keep cards for independent actions and meaningful data groups, not nested decorative boxes. Avoid promotional hero banners on operational screens, redundant eyebrows, glows, stock illustrations, and gradients.
- Admin Action Center: use a white rounded container with a clear title, lightning/action icon, concise explanatory subtitle, and a live total-pending badge. Each action row has a restrained icon tile, action name, short description, live count badge, and navigation chevron. Highlight rows with a positive pending count using a very light violet surface and violet icon/count; keep zero-count rows neutral gray. Keep all rows visible and preserve their existing destinations and data sources.
- Admin User Management mobile screen: follow the approved STITCHGRID reference with a compact violet gradient title banner as a deliberate exception to the no-gradient rule, four compact summary tiles, horizontally scrollable role tabs, search + Filters + Export actions, and responsive user cards. Each card shows avatar, name, email, organization, role, account status, verification, joined date, recorded last login, and a three-dot action menu. Desktop keeps the existing data table.
- User actions: the three-dot menu provides View Details (Overview/Activity), Edit User, Change Role, Activate/Deactivate, and Delete. Use full-height/bottom-sheet mobile dialogs and centered desktop dialogs with explicit confirmation for destructive or access-changing actions. Never imply a last-active timestamp unless it comes from recorded sign-in audit events.
- User filters: provide Account Status, Verification Status, Role, Joined Date (quick ranges and custom dates), and Last Active (recorded sign-in activity) in a dedicated mobile filter sheet. Show active-filter chips and a clear/reset action. Apply filters on the server so pagination and export operate on the same filtered dataset.
- User export: provide Excel-compatible .xlsx, CSV, and PDF (browser print / Save as PDF) choices plus field selection. Export every page of the current filtered result set, not just the visible page.
- Admin Verification mobile screen: use the approved violet Business Verification banner, 2-column KPI cards (total, pending, approved, rejected), horizontally scrollable status tabs, search, Filters and Export actions, and readable organization cards. Preserve the existing desktop verification dashboard and table unchanged.
- Verification filters and export: mobile uses a full-screen filter view for business type, application status, and submitted-date quick ranges/custom dates, with Reset and Apply actions anchored at the bottom. Export filtered applications as Excel (.xlsx), CSV, or printable PDF with selectable fields. Use a separate full-screen preparation state without a fabricated percentage, followed by a completion view with the generated filename and an explicit Download File / Open PDF action.
- Verification details mobile: use Overview, Documents, and Activity tabs with a persistent bottom Approve/Reject action bar for pending applications. Display only data actually stored for the organization, including profile details, existing certifications, business media, and matching audit events. Do not present business photos as legal documents or invent GST/identity attachments or audit history. Confirm approve/reject actions and allow a rejection note. Keep the existing desktop review layout and its API behaviour intact.
- Use the existing desktop admin navigation pattern (sidebar + top bar). On mobile, provide a compact fixed bottom navigation for the primary admin destinations (Overview, Users, RFQs, Orders) plus a More control. More opens the existing collapsible admin navigation drawer for secondary destinations (Verification, Marketplace, Payments, Support, Settings). This is Admin-only navigation and must not reuse Buyer/Supplier tab destinations or workflows.
- Use the existing icon library in the admin application chrome. Keep icon meaning consistent and pair important actions with readable labels.
- Keep controls comfortably usable (minimum 40px desktop target; 44px preferred on touch devices). Support keyboard navigation, visible focus, screen-reader names, and dynamic text.
- Tables and data-dense screens must remain readable: clear column hierarchy, aligned values, sensible empty/loading/error states, and responsive overflow treatment without breaking the page layout.
- Use accessible contrast; secondary text should remain readable on white. Never truncate important business names, statuses, identifiers, or financial values without an accessible way to inspect them.
- Keep forms scrollable and keyboard-aware on smaller screens. Menus and dialogs must remain within the viewport.
- No extra motion for routine navigation. Use subtle transitions only where they clarify interaction.

## Admin-specific layout
- Desktop: persistent left sidebar, compact sticky top bar, and a flexible main content area.
- Tablet/mobile: show a fixed, thumb-friendly Admin bottom navigation with Overview, Users, RFQs, Orders, and More. More opens the collapsible Admin navigation drawer, preserving access to Verification, Marketplace, Payments, Support, and Settings. Keep the drawer available from the header hamburger as well. Do not reuse Buyer/Supplier tab destinations or their workflows.
- Keep page content aligned to a consistent max-width and responsive horizontal padding.
- Keep navigation active states obvious but restrained, using the STITCHGRID violet accent.
- Maintain a consistent page header pattern: title, concise context when needed, and primary action aligned predictably.

## Scope and guardrails
- This design specification applies **only to the STITCHGRID Admin Panel** under `frontend/src/app/(dashboard)/admin` and its admin-only layout/components.
- Do not apply these admin styles or layout changes to Buyer or Supplier web/mobile experiences.
- This is a presentation-led refresh. Existing API routes, authentication/authorization, permissions, and non-user business workflows must remain unchanged. The approved User Management work may add narrowly scoped, Admin-only user detail/profile/role/delete endpoints and server-side list filters where required by the reference UI; every mutation must be authenticated, role-guarded, validated, audited, and protected against self-lockout or loss of the last active Admin.
- Do not add database columns or migrations unless a demonstrated requirement cannot be satisfied by existing User, OrganizationMember, and AuditLog data. Permanent deletion must be refused when the account is linked to organization memberships or authored business records; recommend deactivation instead.
- Preserve all Buyer/Supplier interfaces, APIs, and workflows. Do not modify unrelated Admin modules.
