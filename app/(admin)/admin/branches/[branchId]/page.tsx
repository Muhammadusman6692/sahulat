import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getBranch } from "@/lib/db/branches";
import BranchForm from "../branch-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit branch · Sahulat ERP" };

export default async function EditBranchPage({
  params,
}: PageProps<"/admin/branches/[branchId]">) {
  await requirePermission("BRANCH_MAINT", "EDIT");

  const { branchId } = await params;
  const id = Number(branchId);
  if (!Number.isInteger(id)) notFound();

  const branch = await getBranch(id);
  if (!branch) notFound();

  // Guards against editing a branch in a company outside the user's scope by
  // guessing its id.
  await requireScope(branch.COMPANY_ID);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/branches">Branches</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {branch.BRANCH_NAME}
          </h1>
          <p className={styles.subtitle}>
            {branch.COMPANY_CODE} — {branch.COMPANY_NAME}
          </p>
        </div>
      </div>

      <BranchForm branch={branch} companies={[]} />
    </div>
  );
}
