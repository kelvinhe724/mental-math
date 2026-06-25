// Question generators — ported from questions.py

export type Difficulty = "easy" | "medium" | "hard";
export type SkillId =
  | "add_sub"
  | "mul_1d"
  | "mul_2d"
  | "div"
  | "percent"
  | "frac_arith"
  | "frac_dec"
  | "mixed";

export interface Question {
  text: string;
  answer: number | string;
  difficulty: Difficulty;
  inputType: "number" | "fraction";
}

export const TARGET_TIMES: Record<Difficulty, number> = {
  easy: 3.5,
  medium: 5.0,
  hard: 7.0,
};

export const SKILL_IDS: SkillId[] = [
  "add_sub", "mul_1d", "mul_2d", "div",
  "percent", "frac_arith", "frac_dec", "mixed",
];

export const SKILL_LABELS: Record<SkillId, string> = {
  add_sub:    "Addition / Subtraction",
  mul_1d:     "Multiplication ×1-digit",
  mul_2d:     "Multiplication ×2-digit",
  div:        "Division",
  percent:    "Percentages",
  frac_arith: "Fraction Arithmetic",
  frac_dec:   "Fraction ↔ Decimal",
  mixed:      "Mixed / Multi-step",
};

export const TIPS: Record<SkillId, string[]> = {
  add_sub:    [
    "Round up then correct: 847+299 = 847+300−1 = 1146",
    "Left-to-right: hundreds first, then tens, then ones",
    "For subtraction, count up from the smaller number",
  ],
  mul_1d:     [
    "Decompose: 47×8 = (50×8)−(3×8) = 400−24 = 376",
    "Double and halve: 48×6 = 24×12 = 288",
    "×9 trick: ×10 then subtract the number",
  ],
  mul_2d:     [
    "FOIL: 23×19 = (20+3)(20−1) = 400−20+60−3 = 437",
    "Decompose: 48×35 = 48×30 + 48×5 = 1440+240 = 1680",
    "Round to nearest 10: 47×51 ≈ 50×50 then adjust",
  ],
  div:        [
    "Flip to multiplication: 240÷15 → what ×15 = 240?",
    "÷5 = ×2÷10: 240÷5 = 480÷10 = 48",
    "÷25 = ×4÷100: 300÷25 = 1200÷100 = 12",
  ],
  percent:    [
    "Swap: X% of Y = Y% of X → 24% of 50 = 50% of 24 = 12",
    "Build from 10%: 35% of 80 = 3×8 + 4 = 28",
    "Use fractions: 37.5% = 3/8, 12.5% = 1/8",
  ],
  frac_arith: [
    "Find LCM first, then combine numerators",
    "Cancel across numerators/denominators before multiplying",
    "Division = multiply by the reciprocal",
  ],
  frac_dec:   [
    "Anchors: 1/8=.125, 3/8=.375, 5/8=.625, 7/8=.875",
    "Thirds: 1/3≈.333, 2/3≈.667",
    "Sixths: 1/6≈.167, 5/6≈.833",
  ],
  mixed:      [
    "Identify the hardest sub-step first, solve it, then chain",
    "Estimate the order of magnitude before computing",
  ],
};

// ── helpers ──────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function simplify(n: number, d: number): [number, number] {
  const g = gcd(Math.abs(n), Math.abs(d));
  return [n / g, d / g];
}

function fracStr(n: number, d: number): string {
  const [sn, sd] = simplify(n, d);
  return sd === 1 ? `${sn}` : `${sn}/${sd}`;
}

export function checkAnswer(user: string, correct: number | string, tol = 0.01): boolean {
  const u = parseFloat(user.replace(",", "").replace(" ", ""));
  if (!isNaN(u) && typeof correct === "number") {
    return Math.abs(u - correct) <= tol;
  }
  return user.trim().toLowerCase() === String(correct).trim().toLowerCase();
}

export function getRandomTip(skillId: SkillId): string {
  const tips = TIPS[skillId];
  return tips[Math.floor(Math.random() * tips.length)];
}

// ── generators ────────────────────────────────────────────────────────────────

function genAddSub(d: Difficulty): Question {
  let a: number, b: number;
  if (d === "easy")        { a = rnd(10, 99);   b = rnd(10, 99); }
  else if (d === "medium") { a = rnd(100, 999);  b = rnd(100, 999); }
  else                     { a = rnd(1000, 9999); b = rnd(100, 999); }
  const add = Math.random() < 0.5;
  if (!add && b > a) [a, b] = [b, a];
  return { text: `${a} ${add ? "+" : "−"} ${b}`, answer: add ? a + b : a - b, difficulty: d, inputType: "number" };
}

function genMul1d(d: Difficulty): Question {
  let a: number, b: number;
  if (d === "easy")        { a = rnd(11, 49);  b = rnd(2, 9); }
  else if (d === "medium") { a = rnd(50, 99);  b = rnd(6, 9); }
  else                     { a = rnd(100, 999); b = rnd(6, 9); }
  return { text: `${a} × ${b}`, answer: a * b, difficulty: d, inputType: "number" };
}

function genMul2d(d: Difficulty): Question {
  let a: number, b: number;
  if (d === "easy")        { a = rnd(11, 30); b = rnd(11, 30); }
  else if (d === "medium") { a = rnd(20, 59); b = rnd(11, 49); }
  else                     { a = rnd(40, 99); b = rnd(20, 99); }
  return { text: `${a} × ${b}`, answer: a * b, difficulty: d, inputType: "number" };
}

function genDiv(d: Difficulty): Question {
  let divisor: number, ans: number;
  if (d === "easy")        { divisor = rnd(2, 9);   ans = rnd(5, 20); }
  else if (d === "medium") { divisor = rnd(6, 15);  ans = rnd(10, 40); }
  else                     { divisor = rnd(12, 25); ans = rnd(15, 60); }
  return { text: `${divisor * ans} ÷ ${divisor}`, answer: ans, difficulty: d, inputType: "number" };
}

function genPercent(d: Difficulty): Question {
  const easyPct   = [10, 20, 25, 50, 75, 100];
  const medPct    = [5, 15, 30, 40, 60, 70, 80, 90];
  const hardPct   = [12.5, 37.5, 62.5, 87.5, 33, 67, 17, 83];
  let p: number, n: number;
  if (d === "easy")        { p = pick(easyPct); n = pick([20, 40, 50, 80, 100, 120, 200]); }
  else if (d === "medium") { p = pick(medPct);  n = rnd(3, 30) * 10; }
  else                     { p = pick(hardPct); n = rnd(2, 20) * 8; }
  const ans = Math.round(p * n / 100 * 10000) / 10000;
  return { text: `${p}% of ${n}`, answer: Number.isInteger(ans) ? ans : ans, difficulty: d, inputType: "number" };
}

function genFracArith(d: Difficulty): Question {
  const denoms2 = [2, 3, 4];
  const denoms3 = [2, 3, 4, 5, 6, 8];
  const denoms4 = [2, 3, 4, 5, 6, 8, 10];
  const pool = d === "easy" ? denoms2 : d === "medium" ? denoms3 : denoms4;

  const dA = pick(pool), nA = rnd(1, dA - 1);
  const dB = pick(pool), nB = rnd(1, dB - 1);
  const ops = ["+", "−", "×", "÷"];
  const op = pick(ops);

  let rn: number, rd: number;
  if (op === "+") {
    rn = nA * dB + nB * dA; rd = dA * dB;
  } else if (op === "−") {
    const bigN = nA * dB >= nB * dA;
    rn = bigN ? nA * dB - nB * dA : nB * dA - nA * dB;
    rd = dA * dB;
  } else if (op === "×") {
    rn = nA * nB; rd = dA * dB;
  } else {
    rn = nA * dB; rd = dA * nB;
  }
  const [sn, sd] = simplify(rn, rd);
  const text = op === "−" && nA * dB < nB * dA
    ? `${fracStr(nB, dB)} ${op} ${fracStr(nA, dA)}`
    : `${fracStr(nA, dA)} ${op} ${fracStr(nB, dB)}`;
  return { text, answer: fracStr(sn, sd), difficulty: d, inputType: "fraction" };
}

const FRAC_DEC_TABLE: [string, number][] = [
  ["1/8", 0.125], ["1/6", 0.1667], ["1/4", 0.25], ["1/3", 0.3333],
  ["3/8", 0.375], ["2/5", 0.4],    ["1/2", 0.5],  ["3/5", 0.6],
  ["5/8", 0.625], ["2/3", 0.6667], ["3/4", 0.75], ["4/5", 0.8],
  ["5/6", 0.8333], ["7/8", 0.875],
];

function genFracDec(d: Difficulty): Question {
  const pool = d === "easy"
    ? FRAC_DEC_TABLE.filter(([f]) => ["1/4","1/2","3/4","1/5","2/5","3/5","4/5"].includes(f))
    : d === "medium"
    ? FRAC_DEC_TABLE.filter(([f]) => !["1/6","1/3","2/3","5/6"].includes(f))
    : FRAC_DEC_TABLE;
  const [frac, dec] = pick(pool);
  if (Math.random() < 0.5) {
    return { text: `${frac} = ?`, answer: dec, difficulty: d, inputType: "number" };
  } else {
    return { text: `${dec} = ? (fraction)`, answer: frac, difficulty: d, inputType: "fraction" };
  }
}

function genMixed(d: Difficulty): Question {
  if (d === "easy") {
    const a = rnd(10, 50), b = rnd(2, 9), c = rnd(10, 50);
    return { text: `${a} × ${b} + ${c}`, answer: a * b + c, difficulty: d, inputType: "number" };
  } else if (d === "medium") {
    const p = pick([10, 20, 25, 50]), n = pick([40, 80, 120, 200, 400]);
    const a = rnd(11, 99), b = rnd(2, 9);
    return { text: `${p}% of ${n} + ${a}×${b}`, answer: (p * n / 100) + a * b, difficulty: d, inputType: "number" };
  } else {
    const a = rnd(12, 60), b = rnd(11, 30), c = rnd(5, 20), dd = rnd(2, 9);
    return { text: `${a}×${b} − ${c}×${dd}`, answer: a * b - c * dd, difficulty: d, inputType: "number" };
  }
}

const GENERATORS: Record<SkillId, (d: Difficulty) => Question> = {
  add_sub:    genAddSub,
  mul_1d:     genMul1d,
  mul_2d:     genMul2d,
  div:        genDiv,
  percent:    genPercent,
  frac_arith: genFracArith,
  frac_dec:   genFracDec,
  mixed:      genMixed,
};

export function getQuestion(skillId: SkillId, difficulty: Difficulty): Question {
  return GENERATORS[skillId](difficulty);
}
