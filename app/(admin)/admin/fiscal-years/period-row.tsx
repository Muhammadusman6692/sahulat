import styles from "@/components/data-grid/grid.module.css";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PeriodRow({
  periodNo,
  startDate,
  endDate,
  status,
}: {
  periodNo: number;
  startDate: Date;
  endDate: Date;
  status: "OPEN" | "CLOSED";
}) {
  const closed = status === "CLOSED";

  return (
    <tr>
      <td className={styles.muted}>{periodNo}</td>
      <td className={styles.muted}>{fmtDate(startDate)}</td>
      <td className={styles.muted}>{fmtDate(endDate)}</td>
      <td>
        <span className={closed ? styles.badgeOff : styles.badgeOk}>{status}</span>
      </td>
    </tr>
  );
}
