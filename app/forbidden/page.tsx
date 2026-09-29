import Link from "next/link";

export const metadata = { title: "Not permitted · Sahulat ERP" };

export default function ForbiddenPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "26px 28px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>
          You do not have access to that
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13,
            color: "var(--ink-2)",
            lineHeight: 1.6,
          }}
        >
          Your role does not grant this action, or the record sits outside the
          company, branch or warehouse you are scoped to. An administrator can
          adjust either — permissions cannot be self-granted.
        </p>
        <p style={{ margin: "18px 0 0" }}>
          <Link href="/dashboard" style={{ fontSize: 13, fontWeight: 500 }}>
            Back to dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
