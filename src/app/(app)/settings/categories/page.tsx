import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { ReferenceTable, type FieldSpec } from "@/components/app/reference-table";
import { CHIP_COLORS } from "@/lib/validation/settings";
import { createCategory, deleteCategory, moveCategory, toggleCategoryActive, updateCategory } from "./actions";

export const metadata = { title: "Categories" };

const fields: FieldSpec[] = [
  { key: "color", label: "Colour", type: "select", options: CHIP_COLORS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) })) },
];

export default async function CategoriesPage() {
  await requireRole("ADMIN");
  const categories = await db.category.findMany({ orderBy: { order: "asc" } });

  return (
    <>
      <PageHeader
        title="Categories"
        description="What a matter is about (Debt Recovery, Employment, …). Drives reports; every matter also has a matter type that picks its lifecycle."
      />
      <ReferenceTable
        items={categories.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive, extra: { color: c.color } }))}
        fields={fields}
        addLabel="Add category"
        createAction={createCategory}
        updateAction={updateCategory}
        toggleActiveAction={toggleCategoryActive}
        deleteAction={deleteCategory}
        moveAction={moveCategory}
      />
    </>
  );
}
