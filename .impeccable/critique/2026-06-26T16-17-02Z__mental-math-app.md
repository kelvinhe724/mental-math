---
target: mental-math-app
total_score: 20
p0_count: 0
p1_count: 3
timestamp: 2026-06-26T16-17-02Z
slug: mental-math-app
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Cloud sync fires silently; no save confirmation after a drill ends |
| 2 | Match System / Real World | 3 | Domain language is right for Kelvin; "f↔d" radar label requires interpretation |
| 3 | User Control and Freedom | 3 | Pause and ✕ exit work well; no undo on session delete |
| 4 | Consistency and Standards | 2 | Eyebrow label pattern applied uniformly across every section |
| 5 | Error Prevention | 2 | Confirm on delete/reset ✓; no warning that ending drill early saves a partial session |
| 6 | Recognition Rather Than Recall | 2 | Mode grid doesn't explain Adaptive vs Sim; session trend bars have no date/mode context |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts on home screen; no repeat-last-mode shortcut |
| 8 | Aesthetic and Minimalist Design | 2 | Two absolute-ban patterns: eyebrow labels + hero-metric arc gauge |
| 9 | Error Recovery | 2 | Wrong answer feedback is good; Supabase push failure is silent |
| 10 | Help and Documentation | 1 | No explanation of scoring math; Focus mode has no guidance |
| **Total** | | **20/40** | **Acceptable** |

## Anti-Patterns Verdict
P1: Eyebrow labels on every section (absolute ban). P1: Hero-metric arc gauge template (absolute ban). P1: 3x gray-on-color contrast failures from detector (dashboard:343, drill:166, Numpad:66).

## Priority Issues
[P1] Eyebrow labels on every section — /impeccable layout
[P1] Arc gauge is the hero-metric template — /impeccable shape
[P1] Three gray-on-color contrast failures — /impeccable audit
[P2] Done screen has no immediate "drill again" path — /impeccable harden
[P2] Session trend bars have zero context — /impeccable delight
