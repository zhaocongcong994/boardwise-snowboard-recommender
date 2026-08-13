import type { Board, SupportedCurrency } from "./recommendation";

export type PriceSourceType = "official_flagship" | "brand_official" | "authorized_retailer";

export type CrawlAttempt = {
  sourceType: "official_flagship" | "brand_official";
  platform: string;
  sourceName: string;
  sourceUrl: string;
  status: "matched" | "not_found" | "blocked" | "error";
  checkedAt: string;
  rawPrice?: { amount: number; currency: SupportedCurrency };
  previewImageUrl?: string;
  imageUrl?: string;
  message?: string;
};

export type CatalogPrice = NonNullable<Board["priceInfo"]>;

export type CatalogBoard = Board & { priceInfo: CatalogPrice | null };

export type CatalogSubmission = {
  board: Omit<Board, "price" | "source" | "updatedAt">;
  specificationSource: {
    sourceName: string;
    sourceUrl: string;
    verifiedAt: string;
    contentHash?: string;
    fieldEvidence?: Record<string, string>;
    normalizationNotes?: string[];
  };
  crawlAttempts?: CrawlAttempt[];
  price: CatalogPrice | null;
};

const catalogStyles = ["all-mountain", "carving", "freestyle", "powder"] as const;

const pricePriority: Record<PriceSourceType, number> = {
  official_flagship: 1,
  brand_official: 2,
  authorized_retailer: 3,
};

export function priceSourcePriority(sourceType: PriceSourceType) {
  return pricePriority[sourceType];
}

function priceSourceId(boardId: string, url: string) {
  let hash = 2166136261;
  for (const char of url) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${boardId}-price-${(hash >>> 0).toString(16)}`;
}

export function resolvedPriceSourceId(boardId: string, specificationUrl: string, priceUrl: string) {
  return specificationUrl === priceUrl ? `${boardId}-spec` : priceSourceId(boardId, priceUrl);
}

export function catalogIdentity(brand: string, model: string, season: string, audience = "adult") {
  return [brand, model, season, audience].map((value) => value.trim().toLocaleLowerCase("en-US")).join("::");
}

export function validateCatalogSubmission(input: CatalogSubmission): string[] {
  const errors: string[] = [];
  const { board, specificationSource, price } = input;
  if (!board.brand.trim() || !board.model.trim() || !board.year.trim()) errors.push("品牌、完整型号和雪季不能为空");
  if (!/^\d{2}\/\d{2}$/.test(board.year)) errors.push("雪季格式应为 YY/YY");
  if (!specificationSource.sourceUrl.startsWith("https://")) errors.push("规格来源必须是 HTTPS URL");
  if (!board.variants.length) errors.push("至少需要一个已核验尺码");
  if (board.flex < 1 || board.flex > 10) errors.push("硬度必须在 1–10 之间");
  if (board.imageInfo) {
    if (board.imageInfo.sourceType !== "official_flagship") errors.push("商品主图只能来自品牌官方店铺");
    if (!board.imageInfo.imageUrl.startsWith("https://") || !board.imageInfo.sourceUrl.startsWith("https://")) errors.push("商品主图与店铺来源必须是 HTTPS URL");
  }
  for (const style of catalogStyles) {
    const score = board.styles[style];
    if (score === undefined) {
      errors.push(`${style} 评分字段不能为空，未知值请使用 null`);
      continue;
    }
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 10)) errors.push(`${style} 评分必须为空或在 0–10 之间`);
  }
  for (const variant of board.variants) {
    if (variant.size < 120 || variant.size > 180) errors.push(`尺码 ${variant.size} 超出成人场地板范围`);
    if (variant.waist < 210 || variant.waist > 310) errors.push(`板腰 ${variant.waist} mm 超出合理范围`);
    if (variant.weightMin < 30 || variant.weightMax > 180 || variant.weightMin >= variant.weightMax) errors.push(`尺码 ${variant.size} 的承重范围无效`);
  }
  if (price) {
    if (!Number.isFinite(price.amount) || price.amount <= 0 || price.amount > 1000000) errors.push("价格必须是 0–1,000,000 之间的有效数字");
    if (!price.sourceUrl.startsWith("https://")) errors.push("价格来源必须是 HTTPS URL");
    if (!(price.sourceType in pricePriority)) errors.push("价格来源类型无效");
  }
  for (const attempt of input.crawlAttempts ?? []) {
    if (!attempt.sourceUrl.startsWith("https://")) errors.push("爬虫来源必须是 HTTPS URL");
    if (attempt.previewImageUrl && !attempt.previewImageUrl.startsWith("https://")) errors.push("审核示例图必须是 HTTPS URL");
    if (attempt.imageUrl && attempt.sourceType !== "official_flagship") errors.push("非官方店铺爬虫结果不得提供推荐主图");
  }
  return [...new Set(errors)];
}

type D1Row = Record<string, unknown>;

export async function loadPublishedCatalog(db: D1Database, now = new Date()): Promise<CatalogBoard[]> {
  const models = await db.prepare("SELECT * FROM snowboard_models WHERE status = 'published' ORDER BY brand, model, season DESC").all<D1Row>();
  const variants = await db.prepare("SELECT * FROM snowboard_variants ORDER BY board_id, size, waist").all<D1Row>();
  const prices = await db.prepare(`
    SELECT p.*, s.source_type, s.source_name, s.url
    FROM price_snapshots p
    JOIN catalog_sources s ON s.id = p.source_id
    WHERE p.availability = 'in_stock' AND p.expires_at > ?
    ORDER BY p.observed_at DESC
  `).bind(now.toISOString()).all<D1Row>();

  return models.results.map((row) => {
    const boardPrices = prices.results
      .filter((price) => price.board_id === row.id)
      .sort((a, b) => priceSourcePriority(a.source_type as PriceSourceType) - priceSourcePriority(b.source_type as PriceSourceType));
    const selected = boardPrices[0];
    const sourceType = selected?.source_type as PriceSourceType | undefined;
    const priceInfo: CatalogPrice | null = selected && sourceType ? {
      amount: Number(selected.amount),
      currency: String(selected.currency) as CatalogPrice["currency"],
      sourceType,
      sourceName: String(selected.source_name),
      sourceUrl: String(selected.url),
      observedAt: String(selected.observed_at),
      priceLabel: sourceType === "brand_official" ? "官网展示价" : sourceType === "authorized_retailer" ? "授权店参考价" : "官方店铺价",
    } : null;
    return {
      id: String(row.id),
      brand: String(row.brand),
      model: String(row.model),
      year: String(row.season),
      price: priceInfo?.amount ?? Number.MAX_SAFE_INTEGER,
      level: JSON.parse(String(row.levels_json)),
      styles: JSON.parse(String(row.styles_json)),
      flex: Number(row.flex),
      profile: String(row.profile),
      shape: String(row.shape),
      source: priceInfo?.sourceName ?? "暂无已核验价格",
      updatedAt: priceInfo?.observedAt ?? String(row.updated_at),
      color: String(row.color),
      imageInfo: row.image_url ? {
        imageUrl: String(row.image_url),
        sourceUrl: String(row.image_source_url),
        sourceName: String(row.image_source_name),
        sourceType: "official_flagship",
        observedAt: String(row.image_observed_at),
      } : null,
      variants: variants.results.filter((variant) => variant.board_id === row.id).map((variant) => ({
        size: Number(variant.size), sizeLabel: variant.size_label ? String(variant.size_label) : undefined, waist: Number(variant.waist), weightMin: Number(variant.weight_min), weightMax: Number(variant.weight_max),
      })),
      priceInfo,
    };
  });
}
