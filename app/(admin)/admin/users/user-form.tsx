"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveUserAction, type FormState } from "./actions";
import type { UserDetail, AccessRow } from "@/lib/db/users";
import styles from "@/components/form/form.module.css";

export type CompanyOption = { id: number; code: string; name: string };
export type BranchOption = { id: number; code: string; name: string; companyId: number };
export type WarehouseOption = { id: number; code: string; name: string; branchId: number };
export type RoleOption = { id: number; name: string; companyCode: string | null };

function rowKey(r: AccessRow) {
  return `${r.companyId}:${r.branchId ?? "-"}:${r.warehouseId ?? "-"}`;
}

export default function UserForm({
  user,
  companies,
  branches,
  warehouses,
  roles,
  initialRoleIds,
  initialAccessRows,
}: {
  user: UserDetail | null;
  companies: CompanyOption[];
  branches: BranchOption[];
  warehouses: WarehouseOption[];
  roles: RoleOption[];
  initialRoleIds: number[];
  initialAccessRows: AccessRow[];
}) {
  const action = saveUserAction.bind(null, user?.USER_ID ?? null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));

  const [checkedRoles, setCheckedRoles] = useState<Set<number>>(
    new Set(state.roleIds ?? initialRoleIds),
  );
  const [rows, setRows] = useState<AccessRow[]>(state.accessRows ?? initialAccessRows);

  const [newCompanyId, setNewCompanyId] = useState<string>("");
  const [newBranchId, setNewBranchId] = useState<string>("");
  const [newWarehouseId, setNewWarehouseId] = useState<string>("");

  const branchesInCompany = branches.filter((b) => String(b.companyId) === newCompanyId);
  const warehousesInBranch = warehouses.filter((w) => String(w.branchId) === newBranchId);

  function addRow() {
    if (!newCompanyId) return;
    const row: AccessRow = {
      companyId: Number(newCompanyId),
      branchId: newBranchId ? Number(newBranchId) : null,
      warehouseId: newWarehouseId ? Number(newWarehouseId) : null,
    };
    if (rows.some((r) => rowKey(r) === rowKey(row))) return;
    setRows([...rows, row]);
    setNewCompanyId("");
    setNewBranchId("");
    setNewWarehouseId("");
  }

  function removeRow(key: string) {
    setRows(rows.filter((r) => rowKey(r) !== key));
  }

  function companyLabel(id: number) {
    const c = companies.find((c) => c.id === id);
    return c ? `${c.code} — ${c.name}` : `#${id}`;
  }
  function branchLabel(id: number | null) {
    if (id === null) return "All branches";
    return branches.find((b) => b.id === id)?.code ?? `#${id}`;
  }
  function warehouseLabel(id: number | null) {
    if (id === null) return "All warehouses";
    return warehouses.find((w) => w.id === id)?.code ?? `#${id}`;
  }

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

      {[...checkedRoles].map((id) => (
        <input key={id} type="hidden" name="roleIds" value={id} />
      ))}
      <input type="hidden" name="accessRowsJson" value={JSON.stringify(rows)} />

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Identity</h2>
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="username">
              Username
            </label>
            {user ? (
              <input
                className={`${styles.input} ${styles.mono}`}
                value={user.USERNAME}
                disabled
                readOnly
              />
            ) : (
              <>
                <input
                  id="username"
                  name="username"
                  className={`${fe.username ? styles.inputInvalid : styles.input} ${styles.mono}`}
                  defaultValue={v("username", "")}
                  maxLength={50}
                  required
                />
                {fe.username ? (
                  <span className={styles.fieldError}>{fe.username}</span>
                ) : (
                  <span className={styles.hint}>Fixed once created — used to sign in.</span>
                )}
              </>
            )}
          </div>

          <div className={styles.field}>
            <label className={`${styles.label} ${styles.req}`} htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              className={fe.fullName ? styles.inputInvalid : styles.input}
              defaultValue={v("fullName", user?.FULL_NAME)}
              maxLength={200}
              required
            />
            {fe.fullName && <span className={styles.fieldError}>{fe.fullName}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={fe.email ? styles.inputInvalid : styles.input}
              defaultValue={v("email", user?.EMAIL)}
              maxLength={200}
            />
            {fe.email && <span className={styles.fieldError}>{fe.email}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              className={`${styles.input} ${styles.mono}`}
              defaultValue={v("phone", user?.PHONE)}
              maxLength={20}
            />
          </div>
        </div>
      </div>

      {!user && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Password</h2>
          <div className={styles.section}>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.req}`} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className={fe.password ? styles.inputInvalid : styles.input}
                minLength={8}
                required
              />
              {fe.password ? (
                <span className={styles.fieldError}>{fe.password}</span>
              ) : (
                <span className={styles.hint}>At least 8 characters.</span>
              )}
            </div>
            <div className={styles.field}>
              <label className={`${styles.label} ${styles.req}`} htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className={fe.confirmPassword ? styles.inputInvalid : styles.input}
                minLength={8}
                required
              />
              {fe.confirmPassword && (
                <span className={styles.fieldError}>{fe.confirmPassword}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Roles</h2>
        {roles.length === 0 ? (
          <p className={styles.hint}>No active roles exist yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {roles.map((r) => (
              <label key={r.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={checkedRoles.has(r.id)}
                  onChange={(e) => {
                    const next = new Set(checkedRoles);
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                    setCheckedRoles(next);
                  }}
                />
                {r.name}
                {r.companyCode && (
                  <span className={styles.hint} style={{ marginLeft: 2 }}>
                    ({r.companyCode})
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Company / branch / warehouse access</h2>

        {rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {rows.map((r) => {
              const key = rowKey(r);
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                  }}
                >
                  <span style={{ flexGrow: 1 }}>
                    {companyLabel(r.companyId)}
                    <span className={styles.hint}> · {branchLabel(r.branchId)} · {warehouseLabel(r.warehouseId)}</span>
                  </span>
                  <button
                    type="button"
                    className={styles.btn}
                    style={{ padding: "3px 9px", fontSize: 11 }}
                    onClick={() => removeRow(key)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {fe.accessRows && <p className={styles.fieldError} style={{ marginBottom: 8 }}>{fe.accessRows}</p>}

        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <div className={styles.field} style={{ width: 220 }}>
            <span className={styles.label}>Company</span>
            <select
              className={styles.select}
              value={newCompanyId}
              onChange={(e) => {
                setNewCompanyId(e.target.value);
                setNewBranchId("");
                setNewWarehouseId("");
              }}
            >
              <option value="">— Choose —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field} style={{ width: 180 }}>
            <span className={styles.label}>Branch</span>
            <select
              className={styles.select}
              value={newBranchId}
              disabled={!newCompanyId}
              onChange={(e) => {
                setNewBranchId(e.target.value);
                setNewWarehouseId("");
              }}
            >
              <option value="">— All branches —</option>
              {branchesInCompany.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field} style={{ width: 180 }}>
            <span className={styles.label}>Warehouse</span>
            <select
              className={styles.select}
              value={newWarehouseId}
              disabled={!newBranchId}
              onChange={(e) => setNewWarehouseId(e.target.value)}
            >
              <option value="">— All warehouses —</option>
              {warehousesInBranch.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={styles.btn}
            disabled={!newCompanyId}
            onClick={addRow}
          >
            Add access row
          </button>
        </div>
        <p className={styles.hint} style={{ marginTop: 10 }}>
          Leaving branch or warehouse unset grants access to all of that
          company&apos;s branches, or all of that branch&apos;s warehouses.
        </p>
      </div>

      <div className={styles.card}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            name="activeYn"
            defaultChecked={
              state.values ? state.values.activeYn === "on" : (user?.IS_ACTIVE ?? "Y") === "Y"
            }
          />
          Active
        </label>
        <p className={styles.hint} style={{ marginTop: 6 }}>
          An inactive user cannot sign in, even with the correct password.
        </p>
      </div>

      <div className={styles.actions}>
        <Link href="/admin/users" className={styles.btn}>
          Cancel
        </Link>
        <div className={styles.grow} />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : user ? "Save changes" : "Create user"}
        </button>
      </div>
    </form>
  );
}
