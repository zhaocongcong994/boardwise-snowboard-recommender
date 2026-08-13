export type Level = "first" | "beginner" | "intermediate";
export type Style = "all-mountain" | "carving" | "freestyle" | "powder";
export type ShoeMode = "foot" | "mondo" | "daily-eu";

export type Profile = {
  height: number;
  weight: number;
  shoeMode: ShoeMode;
  shoeValue: number;
  level: Level;
  snowDays: number;
  canLinkTurns: boolean;
  style: Style;
  feel: "easy" | "balanced" | "stable";
  budget: number;
  acceptPastSeason: boolean;
};

export type Board = {
  id: string;
  brand: string;
  model: string;
  year: string;
  price: number;
  level: Level[];
  styles: Record<Style, number>;
  flex: number;
  profile: string;
  shape: string;
  source: string;
  updatedAt: string;
  color: string;
  variants: Array<{ size: number; waist: number; weightMin: number; weightMax: number }>;
  priceInfo?: {
    amount: number;
    currency: "CNY";
    sourceType: "brand_official" | "authorized_retailer" | "official_flagship";
    sourceName: string;
    sourceUrl: string;
    observedAt: string;
    priceLabel: "官网价" | "授权店参考价" | "官方旗舰店参考价";
  } | null;
};

export type Recommendation = {
  board: Board;
  variant: Board["variants"][number];
  score: number;
  confidence: "高" | "中" | "待确认";
  role: "稳妥首选" | "成长型选择" | "性价比选择";
  reasons: string[];
  caution: string;
};

export const PROFILE_LIMITS = {
  height: { min: 130, max: 210 },
  weight: { min: 35, max: 140 },
  foot: { min: 20, max: 32, step: 0.1 },
  mondo: { min: 21, max: 32, step: 0.5 },
  "daily-eu": { min: 34, max: 50, step: 1 },
  snowDays: { min: 0, max: 60 },
  budget: { min: 1500, max: 10000, step: 100 },
} as const;

export type ProfileField = "height" | "weight" | "shoeValue" | "snowDays" | "budget";
export type ProfileValidationErrors = Partial<Record<ProfileField, string>>;

function isFiniteNumber(value: number) {
  return Number.isFinite(value);
}

function isStepAligned(value: number, step: number) {
  return Math.abs(value / step - Math.round(value / step)) < 1e-8;
}

export function validateProfile(profile: Profile): ProfileValidationErrors {
  const errors: ProfileValidationErrors = {};

  if (!isFiniteNumber(profile.height) || profile.height < PROFILE_LIMITS.height.min || profile.height > PROFILE_LIMITS.height.max) {
    errors.height = `请输入 ${PROFILE_LIMITS.height.min}–${PROFILE_LIMITS.height.max} cm 的身高`;
  }
  if (!isFiniteNumber(profile.weight) || profile.weight < PROFILE_LIMITS.weight.min || profile.weight > PROFILE_LIMITS.weight.max) {
    errors.weight = `请输入 ${PROFILE_LIMITS.weight.min}–${PROFILE_LIMITS.weight.max} kg 的体重`;
  }

  const shoeLimit = PROFILE_LIMITS[profile.shoeMode];
  if (!isFiniteNumber(profile.shoeValue) || profile.shoeValue < shoeLimit.min || profile.shoeValue > shoeLimit.max) {
    const unit = profile.shoeMode === "daily-eu" ? "EU" : "cm";
    errors.shoeValue = `请输入 ${shoeLimit.min}–${shoeLimit.max} ${unit} 的有效尺码`;
  } else if (!isStepAligned(profile.shoeValue, shoeLimit.step)) {
    errors.shoeValue = profile.shoeMode === "daily-eu"
      ? "日常鞋码请输入整数 EU 码"
      : profile.shoeMode === "mondo"
        ? "Mondo 尺码请按 0.5 cm 递增"
        : "脚长请精确到 0.1 cm";
  }

  if (!Number.isInteger(profile.snowDays) || profile.snowDays < PROFILE_LIMITS.snowDays.min || profile.snowDays > PROFILE_LIMITS.snowDays.max) {
    errors.snowDays = `滑雪天数应在 ${PROFILE_LIMITS.snowDays.min}–${PROFILE_LIMITS.snowDays.max} 天之间`;
  }
  if (!isFiniteNumber(profile.budget) || profile.budget < PROFILE_LIMITS.budget.min || profile.budget > PROFILE_LIMITS.budget.max) {
    errors.budget = `预算应在 ¥${PROFILE_LIMITS.budget.min.toLocaleString("zh-CN")}–¥${PROFILE_LIMITS.budget.max.toLocaleString("zh-CN")} 之间`;
  } else if (!Number.isInteger(profile.budget) || profile.budget % PROFILE_LIMITS.budget.step !== 0) {
    errors.budget = `预算请输入 ${PROFILE_LIMITS.budget.step} 元的整数倍`;
  }

  return errors;
}

export const boards: Board[] = [
  {
    id: "burton-cultivator",
    brand: "BURTON",
    model: "Cultivator Flat Top",
    year: "25/26",
    price: 2999,
    level: ["first", "beginner", "intermediate"],
    styles: { "all-mountain": 9, carving: 5, freestyle: 8, powder: 4 },
    flex: 3,
    profile: "Flat Top 平拱",
    shape: "True Twin",
    source: "品牌公开规格 · 演示价格",
    updatedAt: "2026-08-12",
    color: "#d8ff55",
    variants: [
      { size: 148, waist: 245, weightMin: 50, weightMax: 68 },
      { size: 151, waist: 248, weightMin: 55, weightMax: 73 },
      { size: 155, waist: 252, weightMin: 64, weightMax: 82 },
      { size: 158, waist: 255, weightMin: 73, weightMax: 91 },
    ],
  },
  {
    id: "salomon-craft",
    brand: "SALOMON",
    model: "Craft",
    year: "25/26",
    price: 3299,
    level: ["beginner", "intermediate"],
    styles: { "all-mountain": 9, carving: 7, freestyle: 8, powder: 5 },
    flex: 4,
    profile: "Rock Out Camber",
    shape: "Directional Twin",
    source: "品牌公开规格 · 演示价格",
    updatedAt: "2026-08-12",
    color: "#ff7548",
    variants: [
      { size: 150, waist: 248, weightMin: 50, weightMax: 70 },
      { size: 153, waist: 251, weightMin: 55, weightMax: 75 },
      { size: 155, waist: 253, weightMin: 60, weightMax: 80 },
      { size: 158, waist: 255, weightMin: 65, weightMax: 90 },
      { size: 158, waist: 263, weightMin: 68, weightMax: 95 },
    ],
  },
  {
    id: "nitro-prime",
    brand: "NITRO",
    model: "Prime Raw",
    year: "25/26",
    price: 2699,
    level: ["first", "beginner"],
    styles: { "all-mountain": 8, carving: 6, freestyle: 7, powder: 4 },
    flex: 3,
    profile: "Flat-Out Rocker",
    shape: "Directional Twin",
    source: "品牌公开规格 · 演示价格",
    updatedAt: "2026-08-12",
    color: "#65d9ff",
    variants: [
      { size: 149, waist: 248, weightMin: 50, weightMax: 70 },
      { size: 152, waist: 250, weightMin: 55, weightMax: 75 },
      { size: 155, waist: 252, weightMin: 60, weightMax: 82 },
      { size: 159, waist: 256, weightMin: 70, weightMax: 95 },
      { size: 159, waist: 268, weightMin: 72, weightMax: 100 },
    ],
  },
  {
    id: "nidecker-merc",
    brand: "NIDECKER",
    model: "Merc",
    year: "25/26",
    price: 3399,
    level: ["beginner", "intermediate"],
    styles: { "all-mountain": 9, carving: 8, freestyle: 6, powder: 7 },
    flex: 5,
    profile: "CamRock",
    shape: "Directional",
    source: "品牌公开规格 · 演示价格",
    updatedAt: "2026-08-12",
    color: "#d9c6ff",
    variants: [
      { size: 152, waist: 250, weightMin: 55, weightMax: 72 },
      { size: 156, waist: 254, weightMin: 62, weightMax: 82 },
      { size: 159, waist: 257, weightMin: 70, weightMax: 92 },
      { size: 159, waist: 263, weightMin: 72, weightMax: 98 },
    ],
  },
  {
    id: "rome-warden",
    brand: "ROME",
    model: "Warden",
    year: "25/26",
    price: 3599,
    level: ["beginner", "intermediate"],
    styles: { "all-mountain": 9, carving: 8, freestyle: 6, powder: 7 },
    flex: 5,
    profile: "Fusion Camber",
    shape: "Directional Twin",
    source: "品牌公开规格 · 演示价格",
    updatedAt: "2026-08-12",
    color: "#ffdc5e",
    variants: [
      { size: 151, waist: 249, weightMin: 52, weightMax: 72 },
      { size: 154, waist: 252, weightMin: 58, weightMax: 78 },
      { size: 157, waist: 255, weightMin: 64, weightMax: 86 },
      { size: 158, waist: 263, weightMin: 68, weightMax: 94 },
    ],
  },
  {
    id: "capita-outerspace",
    brand: "CAPITA",
    model: "Outerspace Living",
    year: "25/26",
    price: 3899,
    level: ["intermediate"],
    styles: { "all-mountain": 9, carving: 8, freestyle: 7, powder: 6 },
    flex: 5,
    profile: "Resort V3",
    shape: "Directional Twin",
    source: "品牌公开规格 · 演示价格",
    updatedAt: "2026-08-12",
    color: "#ff84bb",
    variants: [
      { size: 152, waist: 250, weightMin: 54, weightMax: 72 },
      { size: 154, waist: 252, weightMin: 58, weightMax: 78 },
      { size: 156, waist: 254, weightMin: 63, weightMax: 84 },
      { size: 157, waist: 263, weightMin: 67, weightMax: 92 },
    ],
  },
];

const dailyEuToMondo: Record<number, number> = {
  34: 22, 35: 22.5, 36: 23, 37: 23.5, 38: 24, 39: 25, 40: 25.5,
  41: 26, 42: 27, 43: 27.5, 44: 28, 45: 29, 46: 30, 47: 30.5,
  48: 31, 49: 31.5, 50: 32,
};

export function estimateMondo(profile: Pick<Profile, "shoeMode" | "shoeValue">) {
  if (profile.shoeMode === "daily-eu") {
    return {
      mondo: dailyEuToMondo[profile.shoeValue] ?? Number.NaN,
      estimated: true,
    };
  }
  return { mondo: profile.shoeValue, estimated: false };
}

function requiredWaist(mondo: number) {
  if (mondo >= 29) return 263;
  if (mondo >= 28) return 258;
  if (mondo >= 27) return 252;
  return 244;
}

function idealFlex(profile: Profile) {
  const levelBase = profile.level === "first" ? 3 : profile.level === "beginner" ? 4 : 5;
  const feelDelta = profile.feel === "easy" ? -1 : profile.feel === "stable" ? 1 : 0;
  return Math.max(2, Math.min(7, levelBase + feelDelta));
}

export function recommend(profile: Profile, catalog: Board[] = boards): Recommendation[] {
  if (Object.keys(validateProfile(profile)).length > 0) return [];
  const { mondo, estimated } = estimateMondo(profile);
  const minWaist = requiredWaist(mondo);
  const candidates = catalog.flatMap((board) => {
    const viable = board.variants
      .filter((variant) => profile.weight >= variant.weightMin && profile.weight <= variant.weightMax)
      .filter((variant) => variant.waist >= minWaist)
      .sort((a, b) => {
        const aMid = (a.weightMin + a.weightMax) / 2;
        const bMid = (b.weightMin + b.weightMax) / 2;
        return Math.abs(profile.weight - aMid) - Math.abs(profile.weight - bMid);
      });
    if (!viable.length) return [];

    const variant = viable[0];
    const levelScore = board.level.includes(profile.level) ? 25 : 9;
    const styleScore = board.styles[profile.style] * 2.5;
    const flexDistance = Math.abs(board.flex - idealFlex(profile));
    const flexScore = Math.max(4, 20 - flexDistance * 5);
    const middle = (variant.weightMin + variant.weightMax) / 2;
    const sizeScore = Math.max(6, 15 - Math.abs(profile.weight - middle) * 0.8);
    const budgetScore = board.price <= profile.budget
      ? 10
      : Math.max(0, 10 - ((board.price - profile.budget) / 300));
    const pastSeasonBonus = profile.acceptPastSeason ? 5 : 3;
    const score = levelScore + styleScore + flexScore + sizeScore + budgetScore + pastSeasonBonus;

    const reasons = [
      `${variant.size} cm 尺寸覆盖你的体重区间 ${variant.weightMin}–${variant.weightMax} kg`,
      `${board.profile}配合 ${board.flex}/10 软硬度，适合${profile.level === "intermediate" ? "继续进阶" : "建立稳定控板"}`,
      `${profile.style === "all-mountain" ? "全山适应" : profile.style === "carving" ? "雪道与刻滑" : profile.style === "freestyle" ? "平花与公园" : "粉雪"}匹配度 ${board.styles[profile.style]}/10`,
    ];

    return [{
      board,
      variant,
      score,
      confidence: estimated && variant.waist - minWaist < 5 ? "待确认" as const : estimated ? "中" as const : "高" as const,
      role: "稳妥首选" as const,
      reasons,
      caution: estimated
        ? "当前使用日常鞋码估算板宽；下单前请测量脚长并试穿雪鞋。"
        : board.flex >= 5 && profile.level !== "intermediate"
          ? "板体支撑较强，低速阶段需要更主动地发力。"
          : "建议结合实际站姿角度与雪鞋外壳长度再次确认板宽。",
    }];
  }).sort((a, b) => b.score - a.score);

  const withinBudget = candidates.filter((item) => item.board.price <= profile.budget);
  const primary = withinBudget[0] ?? candidates[0];
  if (!primary) return [];
  const growth = candidates.find((item) => item.board.id !== primary.board.id && item.board.flex >= primary.board.flex) ?? candidates[1];
  const value = [...candidates]
    .filter((item) => item.board.id !== primary.board.id && item.board.id !== growth?.board.id)
    .sort((a, b) => a.board.price - b.board.price)[0] ?? candidates[2];

  return [
    { ...primary, role: "稳妥首选" },
    growth ? { ...growth, role: "成长型选择" } : null,
    value ? { ...value, role: "性价比选择" } : null,
  ].filter(Boolean) as Recommendation[];
}

export const defaultProfile: Profile = {
  height: 172,
  weight: 65,
  shoeMode: "daily-eu",
  shoeValue: 41,
  level: "beginner",
  snowDays: 8,
  canLinkTurns: true,
  style: "all-mountain",
  feel: "balanced",
  budget: 3500,
  acceptPastSeason: true,
};
