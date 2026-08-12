import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const recommendationFeedback = sqliteTable("recommendation_feedback", {
  id: text("id").primaryKey(),
  rating: integer("rating").notNull(),
  selectedBoard: text("selected_board"),
  profileJson: text("profile_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
