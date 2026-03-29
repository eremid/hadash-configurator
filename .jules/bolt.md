## 2025-03-29 - [IconPicker O(N*C) rendering]
**Learning:** The IconPicker was iterating over the entire icon catalog for every category on every render, resulting in O(N*C) complexity. While N is small (~50), this component is replicated for every expanded action and re-renders on every keystroke in the parent.
**Action:** Use `useMemo` to group icons by category in a single pass O(N) and avoid redundant calculations on parent re-renders.
