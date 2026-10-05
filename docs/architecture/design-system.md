# Group ERP Design System — Warm Coral + Teal Enterprise v1.2

This document is the source of truth for the shared visual and interaction
foundation used by every ERP domain. Reference screenshots guide hierarchy and
interaction patterns only; they are not a source of business data or features.

## Product principles

1. Keep the interface calm, compact and operational.
2. Prefer clear hierarchy over decoration.
3. Show only real data and working actions.
4. Reuse shared patterns before creating feature-specific variants.
5. Make every state usable with a keyboard and understandable without colour.

## Theme

Light mode is forced for v1. The interface does not follow the operating-system
theme.

| Role              | Token                      | Value     | Use                                          |
| ----------------- | -------------------------- | --------- | -------------------------------------------- |
| Canvas            | `--background`             | `#FFFFFF` | Bright white page and application background |
| Surface           | `--card`                   | `#FFFFFF` | Cards, tables, dialogs and sheets            |
| Sidebar           | `--sidebar`                | `#FFFFFF` | Navigation background                        |
| Text              | `--foreground`             | `#111827` | Headings and primary content                 |
| Muted text        | `--muted-foreground`       | `#6B7280` | Supporting content                           |
| Border            | `--border`                 | `#EAECF0` | Dividers and surface boundaries              |
| Brand accent      | `--brand`                  | `#E76F51` | Brand marks, icons and data visualization    |
| Accessible action | `--primary`                | `#C84E32` | Solid primary actions with white text        |
| Action hover      | `--primary-hover`          | `#B9472F` | Primary-action hover                         |
| Brand soft        | `--primary-soft`           | `#FFF1EC` | Selected and highlighted states              |
| Secondary brand   | `--brand-secondary`        | `#2A9D8F` | Active and in-progress visualization         |
| Secondary text    | `--brand-secondary-strong` | `#237F75` | Accessible teal text on white                |
| Golden accent     | `--golden-accent`          | `#E9C46A` | Decorative amber visualization               |
| Muted fill        | `--muted`                  | `#FAFBFC` | Local component fills only                   |

Green, amber, red and sky blue are reserved for semantic status:

- Green: success or completed.
- Amber: warning or attention required.
- Red: danger, failed or destructive.
- Sky blue: informational or review.

Do not use semantic colours as decorative accents.
Purple, indigo and violet are not part of the v1.2 product palette.
The brighter coral and teal values are used for icons, charts and large
graphical elements. Solid controls and small coloured text use their darker
accessible companions.

## Typography

- Interface: Figtree.
- Codes and technical values: Geist Mono via `font-mono`.
- Page title: 24–30px, semibold, compact line height.
- Section title: 16px, semibold.
- Body and controls: 14px.
- Supporting content: 12–14px.

Avoid all-caps except small navigation group labels. Table headings use natural
case. Do not use oversized display headings inside business screens.

## Density and geometry

- Desktop controls: 36px.
- Mobile touch targets: at least 44px.
- Table rows: 44px.
- Card padding: 20px.
- Layout gaps: 16px, 20px or 24px.
- Control radius: 8px.
- Card, dialog and sheet radius: 12px.
- Shadows: restrained, used to separate overlays and raised surfaces only.

Avoid decorative gradients, excessive pills and empty space that pushes useful
information below the fold.

## Application shell

- Expanded desktop sidebar: 248px.
- Tablet rail: 72px.
- Header: 60px.
- Mobile: off-canvas navigation sheet.
- The shell is constrained to `100dvh`.
- Sidebar and main content scroll independently.
- The brand is supplied through a reusable shell slot. `Group ERP` is the
  temporary default.
- The shell header contains route breadcrumbs. Business-page titles,
  descriptions and primary actions belong inside the content area.
- Header search, notifications, chat, upgrade and account controls are absent
  until real implementations are supplied through typed header slots.
- Navigation items use `availability: "available" | "planned"`. Planned routes
  remain in metadata but are not rendered.

## Component ownership

- `components/ui`: shadcn/Radix primitives.
- `components/common`: reusable application composites and states.
- `components/layout`: shell, header, navigation and application structure.
- `features/*`: domain-specific composition and business behavior.

Feature code must not copy a shared primitive merely to change spacing or
colour. Add an intentional shared variant instead.

## Shared patterns

### Buttons and fields

- One primary action per action group.
- Destructive actions require confirmation.
- Labels remain visible; placeholders are examples, not labels.
- Validation is placed next to its field and uses `aria-invalid`.
- Optional lookup fields expose a clear action. The clear sentinel is mapped
  back to an empty application value.

### Status

`StatusBadge` uses semantic tones:

`neutral`, `accent`, `progress`, `information`, `success`, `warning`,
`danger`. Progress uses teal; information and review use sky blue.

The label must communicate the state without relying on colour.

### KPI cards

`KpiCard` accepts a string or numeric value, icon, semantic `tone`, `compact` or
`standard` density, helper text, optional real trend data and optional series
points. The icon and title share the first row, followed by the value and
supporting context. This is the same tile hierarchy used on the manager
dashboard and all list workspaces. Never calculate or invent a trend or chart
series in the UI when the API does not provide one. The manager-dashboard pilot
is the sole exception: its coherent fixture is visibly labelled as sample data
and remains isolated from business routes.

### Tables

- Sorting controls must change the visible row order.
- Row height is 44px.
- Interactive rows support Enter and Space and expose a useful accessible name.
- Loading, error and empty states are rendered inside the table boundary.
- Search and filter controls use the table toolbar slot.
- When creation is available, a zero-data state may expose the existing create
  action. A filtered-empty state clears filters instead of suggesting another
  record.
- Filters and pagination stay adjacent to the table they control.
- Row menus do not trigger row selection.

### Overlays

- Use a right-side `FormSheet` for create and edit forms. The sheet keeps page
  context visible, provides independent body scrolling and keeps actions in a
  stable footer.
- Use a centered dialog only for confirmations, compact decisions and lookup
  pickers that do not represent a record form.
- Use a right-side `EntityPreviewSheet` for quick inspection without losing list
  context.
- Use confirmation dialogs for destructive state changes.
- Opening an overlay moves focus inside it; closing restores focus to the
  trigger.

### Entity detail

`EntityDetailLayout` provides a compact summary rail and a flexible main
workspace. Show only tabs backed by real data and working routes.

## Standard states

Every asynchronous surface must define:

1. Skeleton loading state.
2. Success state.
3. Empty state with a specific explanation.
4. Error state with a safe message and retry action where possible.
5. Unavailable state for planned but inaccessible functionality.

Do not render raw serialized API errors. Unexpected API failures should retain
the request reference supplied by the shared API client.

## Accessibility

- Target WCAG 2.2 AA contrast.
- All actions are reachable and operable by keyboard.
- Focus indicators are never removed.
- Dialogs, sheets and mobile navigation contain focus.
- Tabs follow Radix keyboard behavior.
- Icon-only buttons have accessible labels.
- Information is not communicated by colour alone.
- Motion respects `prefers-reduced-motion`.
- Layouts must not create body-level horizontal scrolling at 390px.

## Responsive behavior

- `>= 1024px`: expanded desktop navigation unless manually collapsed.
- `768px–1023px`: fixed compact navigation rail.
- `< 768px`: off-canvas navigation with a 44px menu trigger.
- Tables may scroll within their own boundary; the document body must not.
- Detail summary and workspace stack on smaller screens.

## Release checklist

- Focused ESLint: zero errors and warnings in changed files.
- TypeScript and production build pass.
- Verify at 1440px, 1024px, 768px and 390px.
- Verify keyboard navigation, tabs, sheets, dialogs, lookup clearing and focus
  restoration.
- Verify loading, success, error and empty states.
- Confirm no black theme, fake actions, fake metrics or unfinished global
  controls.
- Confirm no purple, indigo, violet or broad gray surfaces remain.
- Confirm sample manager-dashboard data never appears outside `/dashboard`.
- Do not run destructive tests against AWS RDS.

The development reference is available at `/design-system`. It intentionally
returns not-found in production.
