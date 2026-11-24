# STITCHGRID mobile interface

## Purpose
A calm B2B sourcing and factory-operations workspace. A buyer searches manufacturers, posts RFQs, compares quotes, follows orders and samples; a supplier quotes work and manages production. Show the next task and its current state before any decoration.

## Visual direction
- Preserve the STITCHGRID logo and branded violet (#5B13EC) as the **single interactive accent**.
- Light, cool-gray canvas (#F6F7FA), white task surfaces, ink (#182332), legible secondary text (#48586C).
- Neutral borders (#E2E6ED); use state colors only for real success, warning, error, and order status.
- Use native system sans. Primary page title 22–24, section title 18–20, body 14–16, label 12–13. Avoid excessive bold; 700 is enough for headings.
- Mobile radii: cards 16, controls 12, sheets 20. Group spacing follows 4/8/12/16/24/32.
- Keep cards for independent actions, not nested decorative boxes. Avoid promotional hero banners on task screens, redundant eyebrows, glows, stock illustrations and gradients.
- Icons: MaterialCommunityIcons only in the application chrome. Bottom navigation is shared, always five destinations per role, with one clearly selected tab.
- Tap regions at least 44pt (48dp preferred on Android). Allow dynamic text; never convey status through color alone.
- Respect safe-area insets, keyboard, screen reader names, loading/empty/error states and long text.
- Authentication: center compact content with flexGrow within a ScrollView; never force viewport-height content plus additional safe-area padding. Scroll only if content or the keyboard requires it.
- In chat, use a single conversation header; give the keyboard priority over bottom tabs. Preserve scroll position when reading earlier messages.
- The five primary destinations stay fixed. Requests and Offers share the Offers destination, with their own visible two-way secondary tabs.
- Keep bottom navigation accessible in Settings, but hide it while the keyboard is open. Use scrollable, keyboard-aware forms and pickers; never truncate long lists in a sheet.
- Bundle the approved brand logo locally, and use readable secondary text with at least 4.5:1 contrast on white.
- No extra motion for routine navigation; existing feature and state behavior must stay unchanged.

## Scope
This is a presentation-only refresh. Do not change API routes, authentication, order/payment semantics, RFQ validation, data types, permissions or business workflows as part of visual work. Stubbed functionality remains explicitly out of scope.
