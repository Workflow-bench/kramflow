# Accessibility tree (KF-021) note

The browser tool's `read_page` lists both responsive copies of two landing sections. Computed
visibility at 925 px and 1440 px shows one copy of each heading rendered; the other copy is
`display:none`. The tool does not filter `display:none` nodes from its listing, so its
output cannot settle the question alone. Source of the twins: `components/site/one-cue-section.tsx`
and `components/site/surfaces-section.tsx`. Removing the hidden twins is a refactor, not done here.
