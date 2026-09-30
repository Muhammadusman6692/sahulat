"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import CategoryForm from "./category-form";
import gridStyles from "@/components/data-grid/grid.module.css";

type Category = { id: number; name: string; itemCount: number };

export default function CategoryPanel({
  categories,
  mayCreate,
  mayEdit,
}: {
  categories: Category[];
  mayCreate: boolean;
  mayEdit: boolean;
}) {
  const [modal, setModal] = useState<null | "new" | Category>(null);

  return (
    <div className={gridStyles.card} style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: categories.length === 0 ? 0 : 6 }}>
        <h2 className={gridStyles.title} style={{ fontSize: 16 }}>
          Categories
        </h2>
        {mayCreate && (
          <button type="button" className={gridStyles.btnPrimary} onClick={() => setModal("new")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New category
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <p className={gridStyles.empty}>No item categories yet.</p>
      ) : (
        <table className={gridStyles.table}>
          <thead>
            <tr>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Items</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className={gridStyles.num}>{c.itemCount}</td>
                <td style={{ textAlign: "right" }}>
                  {mayEdit && (
                    <button type="button" className={gridStyles.pageLink} onClick={() => setModal(c)}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "new" ? "New category" : "Edit category"}
      >
        {modal === "new" && (
          <CategoryForm mode="create" onSaved={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
        {modal !== null && modal !== "new" && (
          <CategoryForm mode="edit" category={modal} onSaved={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
      </Modal>
    </div>
  );
}
