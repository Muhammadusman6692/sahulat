"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import UomForm from "./uom-form";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

type Uom = { code: string; name: string; allowDecimal: string };

export default function UomPanel({
  uoms,
  mayCreate,
  mayEdit,
}: {
  uoms: Uom[];
  mayCreate: boolean;
  mayEdit: boolean;
}) {
  const [modal, setModal] = useState<null | "new" | Uom>(null);

  return (
    <div className={gridStyles.card} style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div>
          <h2 className={gridStyles.title} style={{ fontSize: 16 }}>
            Units of Measure
          </h2>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            The units items are stocked and sold in — shared across every company
            on this instance. A code already used by an item can still have its
            name and decimal setting changed, just not be renamed away.
          </p>
        </div>
        {mayCreate && (
          <button type="button" className={gridStyles.btnPrimary} onClick={() => setModal("new")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New unit
          </button>
        )}
      </div>

      <table className={gridStyles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Allows decimal qty</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {uoms.map((u) => (
            <tr key={u.code}>
              <td className={gridStyles.code}>{u.code}</td>
              <td>{u.name}</td>
              <td>
                {u.allowDecimal === "Y" ? (
                  <span style={{ color: "var(--primary)", fontWeight: 600 }}>Yes</span>
                ) : (
                  <span className={gridStyles.muted}>No</span>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                {mayEdit && (
                  <button type="button" className={gridStyles.pageLink} onClick={() => setModal(u)}>
                    Edit
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
        title={modal === "new" ? "New unit of measure" : "Edit unit of measure"}
      >
        {modal === "new" && (
          <UomForm mode="create" onSaved={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
        {modal !== null && modal !== "new" && (
          <UomForm mode="edit" uom={modal} onSaved={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
      </Modal>
    </div>
  );
}
