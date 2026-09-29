import { verifySession } from "@/lib/dal";
import { ACTIONS } from "@/lib/permissions";

export const metadata = { title: "Dashboard · Sahulat ERP" };

const ACTION_LABELS: Array<[string, string]> = [
  [ACTIONS.VIEW, "View"],
  [ACTIONS.CREATE, "Create"],
  [ACTIONS.EDIT, "Edit"],
  [ACTIONS.POST, "Post"],
  [ACTIONS.CANCEL, "Cancel"],
  [ACTIONS.PRINT, "Print"],
  [ACTIONS.APPROVE, "Approve"],
];

export default async function DashboardPage() {
  const user = await verifySession();
  const modules = Object.keys(user.permissions).sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          Signed in as {user.fullName}
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
          This page confirms the login path works end to end: credentials were
          verified against Oracle with bcrypt in Node, and the permission matrix
          below came out of the database with the session.
        </p>
      </div>

      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>User id</div>
          <div className="mono" style={{ fontSize: 13 }}>
            {user.userId}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Username</div>
          <div className="mono" style={{ fontSize: 13 }}>
            {user.username}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Roles</div>
          <div style={{ fontSize: 13 }}>{user.roles.join(", ") || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Scope rows</div>
          <div style={{ fontSize: 13 }}>
            {user.access.map((a, i) => (
              <span key={i} className="mono" style={{ fontSize: 12 }}>
                company {a.companyId} / branch {a.branchId ?? "all"} / warehouse{" "}
                {a.warehouseId ?? "all"}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "11px 14px",
            borderBottom: "1px solid var(--rule)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Your permissions · {modules.length} modules
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--surface-sunken)", color: "var(--ink-2)" }}>
              <th
                style={{
                  padding: "8px 14px",
                  textAlign: "left",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                Module
              </th>
              {ACTION_LABELS.map(([, label]) => (
                <th
                  key={label}
                  style={{
                    padding: "8px 6px",
                    width: 74,
                    fontWeight: 600,
                    borderBottom: "1px solid var(--rule)",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m}>
                <td
                  className="mono"
                  style={{
                    padding: "7px 14px",
                    fontSize: 11,
                    borderBottom: "1px solid #f2f0eb",
                  }}
                >
                  {m}
                </td>
                {ACTION_LABELS.map(([letter, label]) => (
                  <td
                    key={label}
                    style={{
                      padding: "7px 6px",
                      textAlign: "center",
                      borderBottom: "1px solid #f2f0eb",
                      color: user.permissions[m].includes(letter)
                        ? "var(--primary)"
                        : "#c9c3b8",
                      fontWeight: user.permissions[m].includes(letter) ? 700 : 400,
                    }}
                  >
                    {user.permissions[m].includes(letter) ? "Yes" : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
