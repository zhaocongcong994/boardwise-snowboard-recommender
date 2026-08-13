import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const recommendationFeedback = sqliteTable("recommendation_feedback", {
  id: text("id").primaryKey(),
  rating: integer("rating").notNull(),
  selectedBoard: text("selected_board"),
  profileJson: text("profile_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const snowboardModels = sqliteTable("snowboard_models", {
  id: text("id").primaryKey(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  season: text("season").notNull(),
  audience: text("audience").notNull().default("adult"),
  levelsJson: text("levels_json").notNull(),
  stylesJson: text("styles_json").notNull(),
  flex: integer("flex").notNull(),
  profile: text("profile").notNull(),
  shape: text("shape").notNull(),
  color: text("color").notNull().default("#d8ff55"),
  status: text("status").notNull().default("published"),
  publishedAt: text("published_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_snowboard_models_identity").on(table.brand, table.model, table.season, table.audience),
  index("idx_snowboard_models_status").on(table.status),
]);

export const snowboardVariants = sqliteTable("snowboard_variants", {
  id: text("id").primaryKey(),
  boardId: text("board_id").notNull().references(() => snowboardModels.id, { onDelete: "cascade" }),
  size: integer("size").notNull(),
  sizeLabel: text("size_label"),
  waist: integer("waist").notNull(),
  weightMin: real("weight_min").notNull(),
  weightMax: real("weight_max").notNull(),
}, (table) => [
  uniqueIndex("idx_snowboard_variants_board_size_waist").on(table.boardId, table.size, table.waist),
  index("idx_snowboard_variants_board").on(table.boardId),
]);

export const catalogSources = sqliteTable("catalog_sources", {
  id: text("id").primaryKey(),
  boardId: text("board_id").notNull().references(() => snowboardModels.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceName: text("source_name").notNull(),
  url: text("url").notNull(),
  verifiedAt: text("verified_at").notNull(),
  contentHash: text("content_hash"),
  isOfficial: integer("is_official", { mode: "boolean" }).notNull().default(false),
}, (table) => [
  uniqueIndex("idx_catalog_sources_board_url").on(table.boardId, table.url),
  index("idx_catalog_sources_board").on(table.boardId),
]);

export const priceSnapshots = sqliteTable("price_snapshots", {
  id: text("id").primaryKey(),
  boardId: text("board_id").notNull().references(() => snowboardModels.id, { onDelete: "cascade" }),
  sourceId: text("source_id").notNull().references(() => catalogSources.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("CNY"),
  availability: text("availability").notNull().default("in_stock"),
  observedAt: text("observed_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("idx_price_snapshots_board_observed").on(table.boardId, table.observedAt),
  index("idx_price_snapshots_expiry").on(table.expiresAt),
]);

export const catalogChanges = sqliteTable("catalog_changes", {
  id: text("id").primaryKey(),
  identityKey: text("identity_key").notNull(),
  changeType: text("change_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  sourceUrl: text("source_url").notNull(),
  contentHash: text("content_hash").notNull(),
  status: text("status").notNull().default("pending"),
  collectedAt: text("collected_at").notNull(),
  reviewedAt: text("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note"),
}, (table) => [
  uniqueIndex("idx_catalog_changes_hash").on(table.contentHash),
  index("idx_catalog_changes_status_collected").on(table.status, table.collectedAt),
]);

export const catalogReviewEvents = sqliteTable("catalog_review_events", {
  id: text("id").primaryKey(),
  changeId: text("change_id").notNull().references(() => catalogChanges.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  reviewerId: text("reviewer_id").notNull(),
  reviewerEmail: text("reviewer_email").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_catalog_review_events_change").on(table.changeId)]);

export const collectionRuns = sqliteTable("collection_runs", {
  id: text("id").primaryKey(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  sourcesChecked: integer("sources_checked").notNull().default(0),
  changesFound: integer("changes_found").notNull().default(0),
  errorsJson: text("errors_json").notNull().default("[]"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
}, (table) => [index("idx_collection_runs_started").on(table.startedAt)]);
