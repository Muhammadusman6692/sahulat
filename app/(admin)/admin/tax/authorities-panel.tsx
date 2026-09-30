"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import AuthorityForm from "./authority-form";
import styles from "@/components/form/form.module.css";
import gridStyles from "@/components/data-grid/grid.module.css";

type Authority = { code: string; name: string };

export default function AuthoritiesPanel({
  authorities,
  mayCreate,
  mayEdit,
}: {
  authorities: Authority[];
  mayCreate: boolean;
  mayEdit: boolean;
}) {
  const [modal, setModal] = useState<null | "new" | Authority>(null);

  return (
    <div className={gridStyles.card} style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div>
          <h2 className={gridStyles.title} style={{ fontSize: 16 }}>
            Tax Authorities
          </h2>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            The revenue bodies documents are filed with — shared across every
            company on this instance.
          </p>
        </div>
        {mayCreate && (
          <button type="button" className={gridStyles.btnPrimary} onClick={() => setModal("new")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New authority
          </button>
        )}
      </div>

      <table className={gridStyles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {authorities.map((a) => (
            <tr key={a.code}>
              <td className={gridStyles.code}>{a.code}</td>
              <td>{a.name}</td>
              <td style={{ textAlign: "right" }}>
                {mayEdit && (
                  <button type="button" className={gridStyles.pageLink} onClick={() => setModal(a)}>
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
        title={modal === "new" ? "New tax authority" : "Rename tax authority"}
      >
        {modal === "new" && (
          <AuthorityForm mode="create" onSaved={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
        {modal !== null && modal !== "new" && (
          <AuthorityForm mode="edit" authority={modal} onSaved={() => setModal(null)} onCancel={() => setModal(null)} />
        )}
      </Modal>
    </div>
  );
}
