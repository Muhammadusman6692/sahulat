"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveRoleAction, type FormState } from "./actions";
import type { RoleDetail, ModulePermissionRow, ModulePermission } from "@/lib/db/roles";
import formStyles from "@/components/form/form.module.css";
import styles from "./permission-matrix.module.css";

export type CompanyOption = { id: number; code: string; name: string };

const ACTION_KEYS = [
  ["canView", "View"],
  ["canCreate", "Create"],
  ["canEdit", "Edit"],
  ["canPost", "Post"],
  ["canCancel", "Cancel"],
  ["canPrint", "Print"],
  ["canApprove", "Approve"],
] as const;

type Key = (typeof ACTION_KEYS)[number][0];

function toPermission(row: ModulePermissionRow): ModulePermission {
  return {
    moduleCode: row.MODULE_CODE,
    canView: row.CAN_VIEW === "Y",
    canCreate: row.CAN_CREATE === "Y",
    canEdit: row.CAN_EDIT === "Y",
    canPost: row.CAN_POST === "Y",
    canCancel: row.CAN_CANCEL === "Y",
    canPrint: row.CAN_PRINT === "Y",
    canApprove: row.CAN_APPROVE === "Y",
  };
}

export default function RoleForm({
  role,
  companies,
  modules,
}: {
  role: RoleDetail | null;
  companies: CompanyOption[];
  modules: ModulePermissionRow[];
}) {
  const action = saveRoleAction.bind(null, role?.ROLE_ID ?? null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const v = (name: string, stored: string | number | null | undefined) =>
    state.values?.[name] ?? (stored === null || stored === undefined ? "" : String(stored));

  // Re-hydrate from the server's echoed permissions on a validation error,
  // otherwise seed from what the database has for this role (all-N for new).
  const [perms, setPerms] = useState<Record<string, ModulePermission>>(() => {
    const byModule = new Map(state.permissions?.map((p) => [p.moduleCode, p]));
    const out: Record<string, ModulePermission> = {};
    for (const row of modules) {
      out[row.MODULE_CODE] = byModule.get(row.MODULE_CODE) ?? toPermission(row);
    }
    return out;
  });

  const groups = useMemo(() => {
    const map = new Map<string, ModulePermissionRow[]>();
    for (const row of modules) {
      const group = row.MODULE_GROUP ?? "OTHER";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(row);
    }
    return [...map.entries()];
  }, [modules]);

  function setCell(moduleCode: string, key: Key, value: boolean) {
    setPerms((prev) => ({ ...prev, [moduleCode]: { ...prev[moduleCode], [key]: value } }));
  }

  function toggleRow(moduleCode: string) {
    setPerms((prev) => {
      const p = prev[moduleCode];
      const allChecked = ACTION_KEYS.every(([key]) => p[key]);
      const updated: ModulePermission = { ...p };
      for (const [key] of ACTION_KEYS) updated[key] = !allChecked;
      return { ...prev, [moduleCode]: updated };
    });
  }

  function toggleColumn(groupModules: ModulePermissionRow[], key: Key) {
    setPerms((prev) => {
      const allChecked = groupModules.every((m) => prev[m.MODULE_CODE][key]);
      const next = { ...prev };
      for (const m of groupModules) {
        next[m.MODULE_CODE] = { ...next[m.MODULE_CODE], [key]: !allChecked };
      }
      return next;
    });
  }

  const totalGranted = modules.filter((m) =>
    ACTION_KEYS.some(([key]) => perms[m.MODULE_CODE][key]),
  ).length;

  const permissionsJson = JSON.stringify(Object.values(perms));

  return (
    <form action={formAction} className={formStyles.wrap}>
      {state.error && (
        <p className={formStyles.error} role="alert">
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

      <input type="hidden" name="permissionsJson" value={permissionsJson} />

      <div className={formStyles.card}>
        <div className={formStyles.section}>
          <div className={formStyles.field}>
            <label className={`${formStyles.label} ${formStyles.req}`} htmlFor="roleName">
              Role name
            </label>
            <input
              id="roleName"
              name="roleName"
              className={fe.roleName ? formStyles.inputInvalid : formStyles.input}
              defaultValue={v("roleName", role?.ROLE_NAME)}
              maxLength={100}
              required
            />
            {fe.roleName && <span className={formStyles.fieldError}>{fe.roleName}</span>}
          </div>

          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="companyId">
              Company
            </label>
            <select
              id="companyId"
              name="companyId"
              className={formStyles.select}
              defaultValue={v("companyId", role?.COMPANY_ID)}
            >
              <option value="">Global (all companies)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className={formStyles.checkRow} style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            name="activeYn"
            defaultChecked={
              state.values ? state.values.activeYn === "on" : (role?.ACTIVE_YN ?? "Y") === "Y"
            }
          />
          Active
        </label>
      </div>

      <div className={styles.matrixHead}>
        <h2>Permissions</h2>
        <div className={styles.grantSummary}>
          <b>{totalGranted}</b> of {modules.length} modules granted
        </div>
      </div>

      {groups.map(([group, groupModules]) => {
        const granted = groupModules.filter((m) =>
          ACTION_KEYS.some(([key]) => perms[m.MODULE_CODE][key]),
        ).length;
        return (
          <details key={group} className={styles.group} open={group === "ADMIN"}>
            <summary>
              <svg
                className={styles.chev} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="3" strokeLinecap="round"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span className={styles.groupName}>{group}</span>
              <span className={styles.groupCount}>
                <b>{granted}</b> / {groupModules.length} granted
              </span>
            </summary>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colModule}>Module</th>
                  <th className={styles.colAll} />
                  {ACTION_KEYS.map(([key, label]) => (
                    <th key={key} className={styles.colAction}>
                      <button
                        type="button"
                        className={styles.colAllBtn}
                        title={`Toggle ${label} for every module in this group`}
                        onClick={() => toggleColumn(groupModules, key)}
                      >
                        <svg
                          className={styles.colHeadIcon} viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                        >
                          <path d="M5 12h14M12 5v14" />
                        </svg>
                        <span>{label}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupModules.map((m) => {
                  const p = perms[m.MODULE_CODE];
                  return (
                    <tr key={m.MODULE_CODE}>
                      <td>
                        <span className={styles.moduleName}>{m.MODULE_NAME}</span>
                        <span className={styles.moduleCode}>{m.MODULE_CODE}</span>
                      </td>
                      <td className={styles.colAll}>
                        <button
                          type="button"
                          className={styles.rowAllBtn}
                          title="Toggle row"
                          onClick={() => toggleRow(m.MODULE_CODE)}
                        >
                          <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                          >
                            <path d="M5 12h14M12 5v14" />
                          </svg>
                        </button>
                      </td>
                      {ACTION_KEYS.map(([key]) => (
                        <td key={key} className={styles.colAction}>
                          <input
                            type="checkbox"
                            className={styles.cell}
                            checked={p[key]}
                            onChange={(e) => setCell(m.MODULE_CODE, key, e.target.checked)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        );
      })}

      <div className={formStyles.actions} style={{ marginTop: 4 }}>
        <Link href="/admin/roles" className={formStyles.btn}>
          Cancel
        </Link>
        <div className={formStyles.grow} />
        <button type="submit" className={formStyles.btnPrimary} disabled={pending}>
          {pending ? "Saving…" : role ? "Save changes" : "Create role"}
        </button>
      </div>
    </form>
  );
}
