import { SkillId, SKILL_IDS, Question } from "./questions";

export interface Step {
  label: string;
  result: string;
  note?: string;
}

export interface StrategyExample {
  problem: string;
  steps: { desc: string; calc: string }[];
  answer: string;
}

export interface Strategy {
  title: string;
  tagline: string;
  keySteps: string[];
  example: StrategyExample;
}

export interface SkillGuide {
  intro: string;
  strategies: Strategy[];
}

function fmt(n: number): string {
  const s = (Math.round(n * 10000) / 10000).toString();
  const [int, dec] = s.split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? "." + dec : "");
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

// ── Strategy content ──────────────────────────────────────────────────────────

export const GUIDES: Record<SkillId, SkillGuide> = {
  add_sub: {
    intro: "The core principle: never wrestle with ugly numbers. Round first, compensate after. Left-to-right processing keeps a running total instead of carrying.",
    strategies: [
      {
        title: "Round and Compensate",
        tagline: "When a number ends in 7, 8, or 9",
        keySteps: [
          "Round the ugly number UP to the nearest 10 or 100",
          "Add the rounded number (much easier)",
          "Subtract the amount you over-added"
        ],
        example: {
          problem: "847 + 299",
          steps: [
            { desc: "Round 299 → 300 (1 extra)", calc: "" },
            { desc: "847 + 300", calc: "1,147" },
            { desc: "1,147 − 1", calc: "1,146" },
          ],
          answer: "1,146"
        }
      },
      {
        title: "Left-to-Right",
        tagline: "Universal — process hundreds, then tens, then ones",
        keySteps: [
          "Add the hundreds place first — get a running total",
          "Add the tens to the running total (handle carry mentally)",
          "Add the ones last for the final answer"
        ],
        example: {
          problem: "472 + 385",
          steps: [
            { desc: "Hundreds: 400 + 300", calc: "700" },
            { desc: "Tens: 700 + 70 + 80", calc: "850" },
            { desc: "Ones: 850 + 2 + 5", calc: "857" },
          ],
          answer: "857"
        }
      },
      {
        title: "Count Up (Subtraction)",
        tagline: "Eliminates borrowing — count up from smaller to larger",
        keySteps: [
          "Start at the smaller number",
          "Jump to the nearest 10",
          "Jump to the nearest hundred (or the target's hundred)",
          "Jump to the exact target",
          "Sum all the jumps — that's the answer"
        ],
        example: {
          problem: "524 − 387",
          steps: [
            { desc: "387 → 390", calc: "+3" },
            { desc: "390 → 500", calc: "+110" },
            { desc: "500 → 524", calc: "+24" },
            { desc: "Sum: 3 + 110 + 24", calc: "137" },
          ],
          answer: "137"
        }
      }
    ]
  },

  mul_1d: {
    intro: "Single-digit multiplication is about decomposing the larger number into parts that are easy to multiply. Avoid working with awkward numbers directly.",
    strategies: [
      {
        title: "Decompose to Nearest 10",
        tagline: "Round the big number, multiply, then adjust",
        keySteps: [
          "Round the large number to the nearest 10",
          "Multiply the round number by the digit",
          "Multiply the remainder by the digit",
          "Combine: subtract if you rounded up, add if you rounded down"
        ],
        example: {
          problem: "47 × 8",
          steps: [
            { desc: "Round 47 → 50 (diff = 3)", calc: "" },
            { desc: "50 × 8", calc: "400" },
            { desc: "3 × 8", calc: "24" },
            { desc: "400 − 24", calc: "376" },
          ],
          answer: "376"
        }
      },
      {
        title: "×9 Shortcut",
        tagline: "Multiply by 10, then subtract once",
        keySteps: [
          "Multiply by 10 (just append a zero)",
          "Subtract the original number once",
        ],
        example: {
          problem: "67 × 9",
          steps: [
            { desc: "67 × 10", calc: "670" },
            { desc: "670 − 67", calc: "603" },
          ],
          answer: "603"
        }
      },
      {
        title: "Double and Halve",
        tagline: "When one number is even — halve it, double the other",
        keySteps: [
          "Halve the even number",
          "Double the other number",
          "Multiply the new pair (often much simpler)",
        ],
        example: {
          problem: "48 × 6",
          steps: [
            { desc: "Halve 48 → 24, double 6 → 12", calc: "24 × 12" },
            { desc: "24 × 10", calc: "240" },
            { desc: "24 × 2", calc: "48" },
            { desc: "240 + 48", calc: "288" },
          ],
          answer: "288"
        }
      }
    ]
  },

  mul_2d: {
    intro: "Two-digit multiplication is the hardest mental math skill — but three techniques cover almost every question. Master them in order: round-adjust first, FOIL second, decompose third.",
    strategies: [
      {
        title: "Round and Adjust",
        tagline: "Best when one number is within 3 of a multiple of 10",
        keySteps: [
          "Round the messier number to the nearest 10",
          "Multiply: (fixed) × (rounded)",
          "Multiply: (fixed) × (adjustment)",
          "Subtract if you rounded up, add if you rounded down"
        ],
        example: {
          problem: "23 × 47",
          steps: [
            { desc: "Round 47 → 50 (diff = 3)", calc: "" },
            { desc: "23 × 50 = 23 × 5 × 10", calc: "1,150" },
            { desc: "23 × 3", calc: "69" },
            { desc: "1,150 − 69", calc: "1,081" },
          ],
          answer: "1,081"
        }
      },
      {
        title: "FOIL Decomposition",
        tagline: "Best when both numbers are close to the same round value",
        keySteps: [
          "Write A = M + a and B = M − b (where M is a shared round base)",
          "A × B = M² + M(a−b) − ab",
          "This works especially cleanly when A = M+a, B = M−a (so A×B = M²−a²)"
        ],
        example: {
          problem: "23 × 19",
          steps: [
            { desc: "Write as (20+3)(20−1)", calc: "" },
            { desc: "20×20", calc: "400" },
            { desc: "20×(−1) + 3×20", calc: "−20 + 60 = +40" },
            { desc: "3×(−1)", calc: "−3" },
            { desc: "400 + 40 − 3", calc: "437" },
          ],
          answer: "437"
        }
      },
      {
        title: "Decompose Both",
        tagline: "Universal — split one number into tens + ones",
        keySteps: [
          "Split one number into (tens part) + (ones part)",
          "Multiply each part separately by the other number",
          "Add the two results"
        ],
        example: {
          problem: "32 × 45",
          steps: [
            { desc: "32 = 30 + 2", calc: "" },
            { desc: "30 × 45 = 30 × 40 + 30 × 5", calc: "1,200 + 150 = 1,350" },
            { desc: "2 × 45", calc: "90" },
            { desc: "1,350 + 90", calc: "1,440" },
          ],
          answer: "1,440"
        }
      }
    ]
  },

  div: {
    intro: "Think of division as multiplication in reverse: 'what times the divisor gives the dividend?' Build up from easy anchor multiples (×10, ×5) to find the answer.",
    strategies: [
      {
        title: "Think Multiplication",
        tagline: "Always start here — build up from anchor multiples",
        keySteps: [
          "Ask: what × divisor = dividend?",
          "Compute easy anchors: divisor × 10, × 5, × 2",
          "Find the gap and fill it",
        ],
        example: {
          problem: "168 ÷ 12",
          steps: [
            { desc: "12 × 10", calc: "120  (too small, need 48 more)" },
            { desc: "12 × 4", calc: "48" },
            { desc: "10 + 4", calc: "14" },
          ],
          answer: "14"
        }
      },
      {
        title: "Factor the Divisor",
        tagline: "Split the divisor into two factors; divide twice",
        keySteps: [
          "Factor the divisor: e.g. 14 = 7 × 2",
          "Divide by the first factor",
          "Divide that result by the second factor",
        ],
        example: {
          problem: "168 ÷ 14",
          steps: [
            { desc: "14 = 7 × 2", calc: "" },
            { desc: "168 ÷ 7", calc: "24" },
            { desc: "24 ÷ 2", calc: "12" },
          ],
          answer: "12"
        }
      },
      {
        title: "Special Divisors",
        tagline: "÷5, ÷25, ÷15 — use their multiplication equivalents",
        keySteps: [
          "÷5 = ×2 then ÷10",
          "÷25 = ×4 then ÷100",
          "÷15 = ÷3 then ÷5  (or ÷5 then ÷3)",
        ],
        example: {
          problem: "240 ÷ 25",
          steps: [
            { desc: "÷25 = ×4 ÷100", calc: "" },
            { desc: "240 × 4", calc: "960" },
            { desc: "960 ÷ 100", calc: "9.6" },
          ],
          answer: "9.6"
        }
      }
    ]
  },

  percent: {
    intro: "Two tricks cover almost all percentage questions: (1) build from 10%, and (2) swap X% of Y → Y% of X when Y% is simpler. Memorize the fraction equivalents for the rest.",
    strategies: [
      {
        title: "Build from 10%",
        tagline: "Universal — compute 10% first, then scale",
        keySteps: [
          "10% of N = N ÷ 10",
          "5% = half of 10%; 1% = 10% ÷ 10",
          "Combine: 35% = 30% + 5% = 3×(10%) + half of (10%)"
        ],
        example: {
          problem: "35% of 80",
          steps: [
            { desc: "10% of 80", calc: "8" },
            { desc: "30% = 3 × 8", calc: "24" },
            { desc: "5% = 8 ÷ 2", calc: "4" },
            { desc: "24 + 4", calc: "28" },
          ],
          answer: "28"
        }
      },
      {
        title: "Swap Trick",
        tagline: "X% of Y = Y% of X — use whichever is easier",
        keySteps: [
          "X% of Y equals Y% of X (they're the same number)",
          "Check: is Y% of X simpler than X% of Y?",
          "If Y is a round number (25, 50 etc.), the swap is usually easier"
        ],
        example: {
          problem: "24% of 50",
          steps: [
            { desc: "Swap: 24% of 50 = 50% of 24", calc: "" },
            { desc: "50% of 24 = 24 ÷ 2", calc: "12" },
          ],
          answer: "12"
        }
      },
      {
        title: "Fraction Equivalents",
        tagline: "Memorize these: 12.5%=1/8, 37.5%=3/8, 62.5%=5/8, 33⅓%=1/3",
        keySteps: [
          "Recognize the percentage as a known fraction",
          "Divide by the denominator, multiply by the numerator",
        ],
        example: {
          problem: "37.5% of 80",
          steps: [
            { desc: "37.5% = 3/8", calc: "" },
            { desc: "80 ÷ 8", calc: "10" },
            { desc: "10 × 3", calc: "30" },
          ],
          answer: "30"
        }
      }
    ]
  },

  frac_arith: {
    intro: "Fraction arithmetic has fixed mechanics — the skill is doing each step quickly. For multiplication: cancel before you multiply to keep numbers small.",
    strategies: [
      {
        title: "Addition & Subtraction — LCD",
        tagline: "Find the lowest common denominator, then combine",
        keySteps: [
          "Find LCM of the two denominators",
          "Convert each fraction to that denominator",
          "Add or subtract the numerators",
          "Simplify by dividing numerator and denominator by their GCD"
        ],
        example: {
          problem: "3/4 + 2/3",
          steps: [
            { desc: "LCM(4, 3)", calc: "12" },
            { desc: "3/4 = 9/12", calc: "" },
            { desc: "2/3 = 8/12", calc: "" },
            { desc: "9/12 + 8/12", calc: "17/12" },
          ],
          answer: "17/12"
        }
      },
      {
        title: "Multiplication — Cancel First",
        tagline: "Cross-cancel before multiplying to keep numbers small",
        keySteps: [
          "Look for common factors between any numerator and any denominator",
          "Cancel (divide) before multiplying",
          "Multiply the remaining numerators; multiply the remaining denominators",
          "Simplify if needed"
        ],
        example: {
          problem: "4/9 × 3/8",
          steps: [
            { desc: "Cancel 4 and 8 by ÷4 → 1/9 × 3/2", calc: "" },
            { desc: "Cancel 3 and 9 by ÷3 → 1/3 × 1/2", calc: "" },
            { desc: "1 × 1 = 1;  3 × 2 = 6", calc: "1/6" },
          ],
          answer: "1/6"
        }
      },
      {
        title: "Division — Flip and Multiply",
        tagline: "a/b ÷ c/d = a/b × d/c",
        keySteps: [
          "Keep the first fraction exactly as is",
          "Change ÷ to ×",
          "Flip the second fraction (reciprocal)",
          "Proceed as multiplication (cancel first!)"
        ],
        example: {
          problem: "2/3 ÷ 4/5",
          steps: [
            { desc: "Flip: 2/3 × 5/4", calc: "" },
            { desc: "Cancel 2 and 4 by ÷2 → 1/3 × 5/2", calc: "" },
            { desc: "1×5 / 3×2", calc: "5/6" },
          ],
          answer: "5/6"
        }
      }
    ]
  },

  frac_dec: {
    intro: "The fastest approach is memorization. If you know 1/8 = 0.125, you can derive 3/8 = 3 × 0.125 = 0.375 instantly — no calculation needed.",
    strategies: [
      {
        title: "Memory Table (Must Know)",
        tagline: "The 14 key fractions — commit these to memory",
        keySteps: [
          "Halves/quarters: 1/2=0.5, 1/4=0.25, 3/4=0.75",
          "Fifths: 1/5=0.2, 2/5=0.4, 3/5=0.6, 4/5=0.8",
          "Eighths: 1/8=0.125, 3/8=0.375, 5/8=0.625, 7/8=0.875",
          "Thirds/sixths: 1/3≈0.333, 2/3≈0.667, 1/6≈0.167, 5/6≈0.833",
        ],
        example: {
          problem: "5/8 as decimal",
          steps: [
            { desc: "Memorized: 5/8 = 0.625", calc: "" },
          ],
          answer: "0.625"
        }
      },
      {
        title: "Build from Unit Fraction",
        tagline: "If numerator > 1: find 1/d, then multiply",
        keySteps: [
          "Find the unit fraction: 1/d",
          "Multiply by the numerator"
        ],
        example: {
          problem: "3/8 as decimal",
          steps: [
            { desc: "1/8 = 0.125", calc: "" },
            { desc: "3 × 0.125", calc: "0.375" },
          ],
          answer: "0.375"
        }
      },
      {
        title: "Decimal to Fraction",
        tagline: "Express as n/1000 (or n/100), then simplify",
        keySteps: [
          "Write the decimal over 1000 (or 100 if 2 decimal places)",
          "Find GCD of numerator and 1000",
          "Divide both by the GCD to simplify"
        ],
        example: {
          problem: "0.375 as fraction",
          steps: [
            { desc: "0.375 = 375/1000", calc: "" },
            { desc: "GCD(375, 1000) = 125", calc: "" },
            { desc: "375÷125 / 1000÷125", calc: "3/8" },
          ],
          answer: "3/8"
        }
      }
    ]
  },

  mixed: {
    intro: "Multi-step problems reward a clear order of attack. Always handle multiplication/division before addition/subtraction. Estimating first prevents large errors.",
    strategies: [
      {
        title: "Order of Attack",
        tagline: "Identify and solve sub-steps in the right order",
        keySteps: [
          "Scan the full expression first",
          "Compute all multiplications/divisions first (left to right)",
          "Then compute additions/subtractions",
          "If there are percentages, convert to simpler forms first"
        ],
        example: {
          problem: "24 × 8 + 37 × 6",
          steps: [
            { desc: "Priority: both multiplications first", calc: "" },
            { desc: "24 × 8 = (25−1)×8 = 200−8", calc: "192" },
            { desc: "37 × 6 = (40−3)×6 = 240−18", calc: "222" },
            { desc: "192 + 222", calc: "414" },
          ],
          answer: "414"
        }
      },
      {
        title: "Estimate First",
        tagline: "Round to 1 sig fig — sanity-check your answer",
        keySteps: [
          "Round all numbers to 1 significant figure",
          "Compute the rough answer",
          "Solve precisely — your rough estimate flags any major errors",
        ],
        example: {
          problem: "47×31 − 19×8",
          steps: [
            { desc: "Rough: 50×30 − 20×8", calc: "1500 − 160 ≈ 1340" },
            { desc: "47×31 = (50−3)×31 = 1550−93", calc: "1,457" },
            { desc: "19×8 = (20−1)×8 = 160−8", calc: "152" },
            { desc: "1,457 − 152", calc: "1,305  ✓ close to ~1340" },
          ],
          answer: "1,305"
        }
      }
    ]
  }
};

// ── Step generator ────────────────────────────────────────────────────────────

function parseAddSub(text: string) {
  const m = text.match(/^(\d+)\s*([+−])\s*(\d+)$/);
  return m ? { a: +m[1], op: m[2], b: +m[3] } : null;
}
function parseMul(text: string) {
  const m = text.match(/^(\d+)\s*[×\*]\s*(\d+)$/);
  return m ? { a: +m[1], b: +m[2] } : null;
}
function parseDiv(text: string) {
  const m = text.match(/^(\d+)\s*[÷\/]\s*(\d+)$/);
  return m ? { dividend: +m[1], divisor: +m[2] } : null;
}
function parsePercent(text: string) {
  const m = text.match(/^(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+)$/);
  return m ? { p: +m[1], n: +m[2] } : null;
}
function parseFrac(s: string): [number, number] | null {
  const m = s.trim().match(/^(\d+)\/(\d+)$/);
  return m ? [+m[1], +m[2]] : null;
}

function addSubSteps(a: number, op: string, b: number): Step[] {
  if (op === "+") {
    const lastDigit = b % 10;
    if (lastDigit >= 7) {
      const bR = Math.ceil(b / 10) * 10;
      const diff = bR - b;
      const mid = a + bR;
      return [
        { label: `Round ${b} → ${bR}`, result: `added ${diff} extra` },
        { label: `${fmt(a)} + ${fmt(bR)}`, result: fmt(mid) },
        { label: `${fmt(mid)} − ${diff}`, result: fmt(mid - diff), note: "compensate" },
      ];
    }
    const aLastDigit = a % 10;
    if (aLastDigit >= 7) {
      const aR = Math.ceil(a / 10) * 10;
      const diff = aR - a;
      const mid = aR + b;
      return [
        { label: `Round ${a} → ${aR}`, result: `added ${diff} extra` },
        { label: `${fmt(aR)} + ${fmt(b)}`, result: fmt(mid) },
        { label: `${fmt(mid)} − ${diff}`, result: fmt(mid - diff), note: "compensate" },
      ];
    }
    // Left to right
    const bTens = Math.floor(b / 10) * 10;
    const bOnes = b % 10;
    if (bOnes === 0) return [{ label: `${fmt(a)} + ${fmt(bTens)}`, result: fmt(a + b) }];
    const mid = a + bTens;
    return [
      { label: `${fmt(a)} + ${fmt(bTens)}`, result: fmt(mid), note: "tens first" },
      { label: `${fmt(mid)} + ${bOnes}`, result: fmt(a + b) },
    ];
  } else {
    // Subtraction — count up
    const steps: Step[] = [];
    let cur = b;
    if (cur % 10 !== 0) {
      const next = Math.ceil(cur / 10) * 10;
      if (next < a) {
        steps.push({ label: `${cur} → ${next}`, result: `+${next - cur}`, note: "nearest 10" });
        cur = next;
      }
    }
    const aHundred = Math.floor(a / 100) * 100;
    if (aHundred > cur) {
      steps.push({ label: `${fmt(cur)} → ${fmt(aHundred)}`, result: `+${fmt(aHundred - cur)}` });
      cur = aHundred;
    }
    if (cur < a) {
      steps.push({ label: `${fmt(cur)} → ${fmt(a)}`, result: `+${a - cur}` });
    }
    steps.push({ label: `Sum the jumps`, result: fmt(a - b) });
    return steps;
  }
}

function mul1dSteps(a: number, b: number): Step[] {
  if (b === 9) {
    return [
      { label: `${fmt(a)} × 10`, result: fmt(a * 10), note: "×9 = ×10 − ×1" },
      { label: `${fmt(a * 10)} − ${fmt(a)}`, result: fmt(a * 9) },
    ];
  }
  if (b === 5) {
    return [
      { label: `${fmt(a)} × 10`, result: fmt(a * 10), note: "×5 = ×10 ÷ 2" },
      { label: `${fmt(a * 10)} ÷ 2`, result: fmt(a * 5) },
    ];
  }
  const aR = Math.round(a / 10) * 10;
  const diff = aR - a;
  if (diff === 0) return [{ label: `${fmt(a)} × ${b}`, result: fmt(a * b) }];
  return [
    { label: `Round ${a} → ${aR}`, result: `diff = ${Math.abs(diff)}` },
    { label: `${fmt(aR)} × ${b}`, result: fmt(aR * b) },
    { label: `${Math.abs(diff)} × ${b}`, result: fmt(Math.abs(diff) * b), note: "adjustment" },
    { label: diff > 0 ? `${fmt(aR * b)} − ${fmt(diff * b)}` : `${fmt(aR * b)} + ${fmt(Math.abs(diff) * b)}`, result: fmt(a * b) },
  ];
}

function mul2dSteps(a: number, b: number): Step[] {
  const bR = Math.round(b / 10) * 10;
  const aR = Math.round(a / 10) * 10;
  const bDiff = Math.abs(b - bR);
  const aDiff = Math.abs(a - aR);

  // Round whichever is closer to nearest 10
  const [fixed, rounded, nearest, diff] =
    bDiff <= aDiff
      ? [a, b, bR, bR - b]
      : [b, a, aR, aR - a];

  const main = fixed * nearest;
  const adj  = Math.abs(fixed * diff);
  return [
    { label: `Round ${rounded} → ${nearest}`, result: `diff = ${diff > 0 ? "+" : "−"}${Math.abs(diff)}` },
    { label: `${fmt(fixed)} × ${fmt(nearest)}`, result: fmt(main) },
    { label: `${fmt(fixed)} × ${Math.abs(diff)}`, result: fmt(Math.abs(fixed * diff)), note: "adjustment" },
    { label: diff > 0 ? `${fmt(main)} − ${fmt(adj)}` : `${fmt(main)} + ${fmt(adj)}`, result: fmt(a * b) },
  ];
}

function divSteps(dividend: number, divisor: number): Step[] {
  // Try factor decomposition
  for (let f = 2; f <= Math.sqrt(divisor); f++) {
    if (divisor % f === 0) {
      const other = divisor / f;
      const mid = dividend / f;
      if (Number.isInteger(mid)) {
        return [
          { label: `Factor: ${divisor} = ${f} × ${other}`, result: "" },
          { label: `${dividend} ÷ ${f}`, result: fmt(mid) },
          { label: `${fmt(mid)} ÷ ${other}`, result: fmt(mid / other) },
        ];
      }
    }
  }
  // Build from ×10
  const tenX = divisor * 10;
  if (tenX <= dividend) {
    const rem = dividend - tenX;
    const remDiv = rem / divisor;
    return [
      { label: `${divisor} × 10 = ${tenX}`, result: `anchor`, note: "start here" },
      { label: `Remainder: ${dividend} − ${tenX}`, result: fmt(rem) },
      { label: `${rem} ÷ ${divisor}`, result: fmt(remDiv) },
      { label: `10 + ${fmt(remDiv)}`, result: fmt(dividend / divisor) },
    ];
  }
  return [{ label: `${dividend} ÷ ${divisor}`, result: fmt(dividend / divisor) }];
}

function percentSteps(p: number, n: number): Step[] {
  // Fraction equivalents
  const FRACS: [number, string, number, number][] = [
    [50, "1/2", 1, 2], [25, "1/4", 1, 4], [75, "3/4", 3, 4],
    [33.33, "1/3", 1, 3], [66.67, "2/3", 2, 3],
    [12.5, "1/8", 1, 8], [37.5, "3/8", 3, 8], [62.5, "5/8", 5, 8], [87.5, "7/8", 7, 8],
    [20, "1/5", 1, 5], [40, "2/5", 2, 5], [60, "3/5", 3, 5], [80, "4/5", 4, 5],
  ];
  for (const [pct, frac, num, den] of FRACS) {
    if (Math.abs(p - pct) < 0.1) {
      const steps: Step[] = [{ label: `${p}% = ${frac}`, result: "" }];
      if (num === 1) {
        steps.push({ label: `${n} ÷ ${den}`, result: fmt(n / den) });
      } else {
        steps.push({ label: `${n} ÷ ${den}`, result: fmt(n / den) });
        steps.push({ label: `${fmt(n / den)} × ${num}`, result: fmt(n * num / den) });
      }
      return steps;
    }
  }
  // Swap check
  if ([10, 20, 25, 50].includes(n)) {
    return [
      { label: `Swap: ${p}% of ${n} = ${n}% of ${p}`, result: "", note: "X% of Y = Y% of X" },
      { label: `${n}% of ${p} = ${p} × ${n / 100}`, result: fmt(p * n / 100) },
    ];
  }
  // Build from 10%
  const ten = n / 10;
  const wholeTens = Math.floor(p / 10);
  const rem = p - wholeTens * 10;
  if (rem === 0) {
    return [
      { label: `10% of ${n}`, result: fmt(ten) },
      { label: `${p}% = ${wholeTens} × ${fmt(ten)}`, result: fmt(ten * wholeTens) },
    ];
  }
  const one = n / 100;
  return [
    { label: `10% of ${n}`, result: fmt(ten) },
    { label: `${wholeTens * 10}%: ${wholeTens} × ${fmt(ten)}`, result: fmt(ten * wholeTens) },
    { label: `${rem}%: ${rem} × ${fmt(one)}`, result: fmt(one * rem) },
    { label: `${fmt(ten * wholeTens)} + ${fmt(one * rem)}`, result: fmt(p * n / 100) },
  ];
}

function fracArithSteps(text: string): Step[] {
  const m = text.match(/^(.+?)\s*([+−×÷])\s*(.+)$/);
  if (!m) return [];
  const lf = parseFrac(m[1]), op = m[2], rf = parseFrac(m[3]);
  if (!lf || !rf) return [];
  const [ln, ld] = lf, [rn, rd] = rf;

  if (op === "+" || op === "−") {
    const lcm = ld * rd / gcd(ld, rd);
    const lNew = ln * (lcm / ld), rNew = rn * (lcm / rd);
    const resN = op === "+" ? lNew + rNew : lNew - rNew;
    const g2 = gcd(Math.abs(resN), lcm);
    return [
      { label: `LCM(${ld}, ${rd})`, result: `${lcm}` },
      { label: `${ln}/${ld} → ${lNew}/${lcm}`, result: "" },
      { label: `${rn}/${rd} → ${rNew}/${lcm}`, result: "" },
      { label: `${lNew} ${op === "−" ? "−" : "+"} ${rNew}`, result: `${resN}/${lcm}` },
      ...(g2 > 1 ? [{ label: `Simplify ÷${g2}`, result: `${resN / g2}/${lcm / g2}` }] : []),
    ];
  }
  if (op === "×") {
    const g1 = gcd(ln, rd), g2 = gcd(rn, ld);
    const lnR = ln / g1, rdR = rd / g1, rnR = rn / g2, ldR = ld / g2;
    const steps: Step[] = [];
    if (g1 > 1) steps.push({ label: `Cancel ${ln} and ${rd} ÷${g1}`, result: `→ ${lnR}/${ldR} × ${rnR}/${rdR}` });
    if (g2 > 1) steps.push({ label: `Cancel ${rn} and ${ld} ÷${g2}`, result: `→ ${lnR}/${ldR} × ${rnR}/${rdR}` });
    const numR = lnR * rnR, denR = ldR * rdR;
    steps.push({ label: `${lnR} × ${rnR} = ${numR};  ${ldR} × ${rdR} = ${denR}`, result: `${numR}/${denR}` });
    const g3 = gcd(numR, denR);
    if (g3 > 1) steps.push({ label: `Simplify ÷${g3}`, result: `${numR / g3}/${denR / g3}` });
    return steps;
  }
  if (op === "÷") {
    return [
      { label: `Flip: ${ln}/${ld} × ${rd}/${rn}`, result: "", note: "multiply by reciprocal" },
      ...fracArithSteps(`${ln}/${ld} × ${rd}/${rn}`),
    ];
  }
  return [];
}

function fracDecSteps(q: Question): Step[] {
  const isDec = !q.text.includes("/");
  if (isDec) {
    // decimal → fraction
    const val = parseFloat(q.text);
    const digits = q.text.replace("0.", "").length;
    const denom = Math.pow(10, digits);
    const numer = Math.round(val * denom);
    const g = gcd(numer, denom);
    return [
      { label: `0.${q.text.split(".")[1]} = ${numer}/${denom}`, result: "" },
      { label: `GCD(${numer}, ${denom})`, result: `${g}` },
      { label: `${numer}÷${g} / ${denom}÷${g}`, result: `${numer / g}/${denom / g}` },
    ];
  } else {
    // fraction → decimal
    const f = parseFrac(q.text);
    if (!f) return [];
    const [n, d] = f;
    if (n === 1) {
      return [
        { label: `1/${d} — memorize or compute 1÷${d}`, result: fmt(1 / d) },
      ];
    }
    return [
      { label: `1/${d}`, result: fmt(1 / d), note: "unit fraction" },
      { label: `${n} × ${fmt(1 / d)}`, result: fmt(n / d) },
    ];
  }
}

function mixedSteps(q: Question): Step[] {
  // Easy: "a × b + c"
  const easyM = q.text.match(/^(\d+)\s*×\s*(\d+)\s*\+\s*(\d+)$/);
  if (easyM) {
    const [, a, b, c] = easyM.map(Number);
    const prod = a * b;
    return [
      ...mul1dSteps(a, b).map(s => ({ ...s, note: "mul first" })),
      { label: `${fmt(prod)} + ${c}`, result: fmt(prod + c) },
    ];
  }
  // Hard: "a×b − c×d" (no spaces)
  const hardM = q.text.match(/^(\d+)×(\d+)\s*−\s*(\d+)×(\d+)$/);
  if (hardM) {
    const [, a, b, c, d] = hardM.map(Number);
    return [
      { label: `First: ${a}×${b}`, result: fmt(a * b), note: "mul separately" },
      { label: `Second: ${c}×${d}`, result: fmt(c * d) },
      { label: `${fmt(a * b)} − ${fmt(c * d)}`, result: fmt(a * b - c * d) },
    ];
  }
  // Medium: "p% of n + a×b"
  const medM = q.text.match(/^(\d+(?:\.\d+)?)%\s*of\s*(\d+)\s*\+\s*(\d+)×(\d+)$/);
  if (medM) {
    const p = +medM[1], n = +medM[2], a = +medM[3], b = +medM[4];
    const pctResult = p * n / 100;
    return [
      ...percentSteps(p, n).map(s => ({ ...s, note: "percent first" })),
      { label: `${a}×${b}`, result: fmt(a * b) },
      { label: `${fmt(pctResult)} + ${fmt(a * b)}`, result: fmt(pctResult + a * b) },
    ];
  }
  return [{ label: "Break into sub-steps", result: fmt(q.answer as number) }];
}

export function solveSteps(q: Question, skillId: SkillId): Step[] {
  try {
    switch (skillId) {
      case "add_sub": {
        const p = parseAddSub(q.text);
        return p ? addSubSteps(p.a, p.op, p.b) : [];
      }
      case "mul_1d": {
        const p = parseMul(q.text);
        return p ? mul1dSteps(p.a, p.b) : [];
      }
      case "mul_2d": {
        const p = parseMul(q.text);
        return p ? mul2dSteps(p.a, p.b) : [];
      }
      case "div": {
        const p = parseDiv(q.text);
        return p ? divSteps(p.dividend, p.divisor) : [];
      }
      case "percent": {
        const p = parsePercent(q.text);
        return p ? percentSteps(p.p, p.n) : [];
      }
      case "frac_arith":
        return fracArithSteps(q.text);
      case "frac_dec":
        return fracDecSteps(q);
      case "mixed":
        return mixedSteps(q);
      default:
        return [];
    }
  } catch {
    return [];
  }
}
