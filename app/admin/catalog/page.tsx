import { requireChatGPTUser } from "../../chatgpt-auth";
import AdminCatalogClient from "./AdminCatalogClient";

export const dynamic = "force-dynamic";

export default async function CatalogAdminPage() {
  const user = await requireChatGPTUser("/admin/catalog");
  return <AdminCatalogClient userEmail={user.email} />;
}
