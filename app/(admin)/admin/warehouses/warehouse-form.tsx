"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveWarehouse, type FormState } from "./actions";
import type { WarehouseRow } from "@/lib/db/warehouses";
import { LockedField } from "@/components/form/locked-field";
import styles from "@/components/form/form.module.css";

export type BranchOption = {
  id: number;
  code: string;
  name: string;
  companyId: number;
  companyCode: string;
};

export default function WarehouseForm({
  warehouse,
  branches,
  linkedBranchIds,
}: {
  warehouse: WarehouseRow | null;
  branches: BranchOption[];
  linkedBranchIds: number[];
}) {
  const action = saveWarehouse.bind(null, warehouse?.WAREHOUSE_ID ?? null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));

  const [ownerBranchId, setOwnerBranchId] = useState<number>(
    Number(state.values?.branchId ?? warehouse?.BRANCH_ID ?? branches[0]?.id ?? 0),
  );
  const [shared, setShared] = useState<boolean>(
    state.values
      ? state.values.isShared === "on"
      : (warehouse?.IS_SHARED ?? "N") === "Y",
  );

  const owner = branches.find((b) => b.id === ownerBranchId);
  // Only branches in the same company can share a warehouse — stock belongs to
  // one company's books.
  const shareable = branches.filter(
    (b) => b.companyId === owner?.companyId && b.id !== ownerBranchId,
  );
  const checkedLinks = new Set(state.linked ?? linkedBranchIds);

  return (
    <form action={formAction} className={styles.wrap}>
      {state.error && (
        <p className={styles.error} role="alert">
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ flexShrink: 0, marginTop: 1 }}
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          {state.error}
        </p>
      )}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Identity</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="branchId">
              Owning branch
            </label>
            {warehouse ? (
              <>
                <LockedField value={`${warehouse.BRANCH_CODE} — ${warehouse.BRANCH_NAME}`} mono />
                <input type="hidden" name="companyId" value={warehouse.COMPANY_ID} />
                <input type="hidden" name="branchId" value={warehouse.BRANCH_ID} />
                <span className={styles.hint}>
                  The owning branch is fixed. Stock is valued per branch, so
                  moving a warehouse would rewrite history it does not own.
                </span>
              </>
            ) : (
              <>
                <select
                  id="branchId"
                  name="branchId"
                  className={styles.select}
                  value={ownerBranchId || ""}
                  onChange={(e) => setOwnerBranchId(Number(e.target.value))}
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.companyCode} · {b.code} — {b.name}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="companyId" value={owner?.companyId ?? ""} />
                {fe.branchId && <span className={styles.fieldError}>{fe.branchId}</span>}
              </>
            )}
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="warehouseCode">
              Warehouse code
            </label>
            <input
              id="warehouseCode"
              name="warehouseCode"
              className={`${fe.warehouseCode ? styles.inputInvalid : styles.input} ${styles.mono}`}
              defaultValue={v("warehouseCode", warehouse?.WAREHOUSE_CODE)}
              maxLength={10}
              required
            />
            {fe.warehouseCode ? (
              <span className={styles.fieldError}>{fe.warehouseCode}</span>
            ) : (
              <span className={styles.hint}>Unique within the company.</span>
            )}
          </div>

          <div className={styles.fieldWide}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="warehouseName">
              Warehouse name
            </label>
            <input
              id="warehouseName"
              name="warehouseName"
              className={fe.warehouseName ? styles.inputInvalid : styles.input}
              defaultValue={v("warehouseName", warehouse?.WAREHOUSE_NAME)}
              maxLength={200}
              required
            />
            {fe.warehouseName && (
              <span className={styles.fieldError}>{fe.warehouseName}</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Branch access</h2>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            name="isShared"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
          Shared with other branches of the same company
        </label>
        <p className={styles.hint} style={{ marginTop: 6 }}>
          A shared warehouse can be issued from and received into by more than
          one branch. The owning branch always has access.
        </p>

        {shared && (
          <div style={{ marginTop: 12 }}>
            {shareable.length === 0 ? (
              <p className={styles.hint}>
                This company has no other active branch to share with yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {shareable.map((b) => (
                  <label key={b.id} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      name="linkedBranchIds"
                      value={b.id}
                      defaultChecked={checkedLinks.has(b.id)}
                    />
                    <span className={styles.mono} style={{ fontSize: 12 }}>
                      {b.code}
                    </span>
                    {b.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            name="activeYn"
            defaultChecked={
              state.values
                ? state.values.activeYn === "on"
                : (warehouse?.ACTIVE_YN ?? "Y") === "Y"
            }
          />
          Active
        </label>
        <p className={styles.hint} style={{ marginTop: 6 }}>
          An inactive warehouse keeps its stock history and stops appearing when
          a document asks where goods move from or to.
        </p>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/warehouses" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : warehouse ? "Save changes" : "Create warehouse"}
        </button>
      </div>
    </form>
  );
}
