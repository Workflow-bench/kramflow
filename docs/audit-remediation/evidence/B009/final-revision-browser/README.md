# Final-revision browser checks (B009)

Production webpack build of the final tree, port 3949. Scripts are copies of the pass-2 scripts with the port changed.

- `reduced-motion.out`: reduce vs no-preference, 375 px.
- `a11y-pass.out`: reflow 320/375/768/1024/1440, skip link, login expired-link message. Its `headings.duplicates` value is a COMPUTED-visibility check (`display` of the heading element only). It counts the hidden mobile twin of the One-cue heading as a duplicate. The accessibility-tree check (`ax-final.json`, CDP `Accessibility.getFullAXTree`) is the authoritative result and reports no duplicates. The script is kept unchanged as the record of why computed visibility is not tree evidence.
- `login-toggle.out`: password show/hide.
- `ax-final.json`: accessibility tree (CDP) for landing desktop, landing mobile and login.
- Harness: `curl /dev/rehearsal?fixture=multi` on this production build returns 404.
