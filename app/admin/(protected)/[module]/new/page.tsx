import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { dataToValues } from "@/lib/content/codec";
import { entityByModule } from "@/lib/content/registry";
import { ContentForm } from "@/components/admin/ContentForm";
import { PageHeader } from "@/components/admin/ui";

export default async function NewItem({ params }: PageProps<"/admin/[module]/new">) {
  const user = await requireAdmin("content:write");
  const { module } = await params;
  const def = entityByModule(module);
  if (!def || def.singleton) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`New ${def.singular.toLowerCase()}`} description="Saved as a private draft. Publish when it is ready." />
      <ContentForm module={module} id="new" fields={def.fields} initial={dataToValues(def.fields, {})} canPublish={can(user.role, "content:publish")} />
    </div>
  );
}
