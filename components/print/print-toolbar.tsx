"use client";

import formStyles from "@/components/form/form.module.css";
import styles from "./voucher-print.module.css";

export default function PrintToolbar() {
  return (
    <div className={styles.toolbar}>
      <button type="button" className={formStyles.btn} onClick={() => window.close()}>
        Close
      </button>
      <button type="button" className={formStyles.btnPrimary} onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
