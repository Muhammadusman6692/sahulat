import styles from "@/components/data-grid/grid.module.css";

export default function FiscalYearStatus({ status }: { status: "OPEN" | "CLOSED" }) {
  return (
    <span className={status === "CLOSED" ? styles.badgeOff : styles.badgeOk}>
      {status}
    </span>
  );
}
