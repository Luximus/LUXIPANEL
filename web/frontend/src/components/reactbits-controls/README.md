# React Bits controls in LUXIPANEL

Vendored from [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits),
commit `ca44b3f9ee180676a06d7de8ec6bea84cddff85b`.
Retain [LICENSE.md](./LICENSE.md) when distributing these files.

- [Shredder](https://reactbits.dev/micro/shredder): `ReorderList` is the shared,
  non-destructive variant for terminal history and DataTable columns. Only the
  grip starts a drag; rows keep their interactive controls. The native adapter
  supports module grids, touch, keyboard and the existing persistence callback.
- [Spring Check](https://reactbits.dev/micro/spring-check): used directly in
  terminal history. The native form variant in `reactbits-controls.css` applies
  its rounded box, spring fill and tick to every existing checkbox, preserving
  labels, form submission/reset, disabled state and indeterminate selection.
- [Rubber Segment](https://reactbits.dev/micro/rubber-segment): the native adapter
  ports its edge dilation, handoff and spring relaxation to existing React/Astro
  tab controls, including vertical drawer navigation. It delegates selection to
  the original buttons and supports keyboard, pointer dragging, both themes and
  reduced motion. `RubberSegment.tsx` remains available for standalone controls.

`DocumentHead` initializes the adapter once. It discovers dynamically mounted
tabs, updates their thumb when selection/size changes, and disposes detached
groups. Explicitly mark new custom tab groups with `data-rubber-tabs`.
