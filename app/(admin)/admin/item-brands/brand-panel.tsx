"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import BrandForm from "./brand-form";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

type Brand = { brandId: number; name: string };

export default function BrandPanel({
  companyId,
  brands,
  mayCreate,
  mayEdit,
}: {
  companyId: number;
  brands: Brand[];
  mayCreate: boolean;
  mayEdit: boolean;
}) {
  const [modal, setModal] = useState<null | "new" | Brand>(null);

  return (
    <div className={gridStyles.card} style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div>
          <h2 className={gridStyles.title} style={{ fontSize: 16 }}>
            Brands
          </h2>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            Each company keeps its own brand list. No delete — items reference
            brands by id, so rename instead.
          </p>
        </div>
        {mayCreate && (
          <button type="button" className={gridStyles.btnPrimary} onClick={() => setModal("new")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New brand
          </button>
        )}
      </div>

      <table className={gridStyles.table}>
        <thead>
          <tr>
            <th>Brand</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {brands.map((b) => (
            <tr key={b.brandId}>
              <td>{b.name}</td>
              <td style={{ textAlign: "right" }}>
                {mayEdit && (
                  <button type="button" className={gridStyles.pageLink} onClick={() => setModal(b)}>
                    Rename
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "new" ? "New brand" : "Rename brand"}
      >
        {modal === "new" && (
          <BrandForm mode="create" companyId={companyId} onSaved={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
        {modal !== null && modal !== "new" && (
          <BrandForm
            mode="edit"
            companyId={companyId}
            brand={modal}
            onSaved={() => setModal(null)}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
