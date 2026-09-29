import { Suspense } from "react";
import LoginForm from "./login-form";
import styles from "./login.module.css";

export const metadata = { title: "Sign in · Sahulat ERP" };

export default function LoginPage() {
  return (
    <div className={styles.shell}>
      <section className={styles.brandPane}>
        <div className={styles.brandRow}>
          <span className={styles.mark}>
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M3 9h18M3 15h18M9 3v18" />
            </svg>
          </span>
          <span>
            <span className={styles.wordmark}>SAHULAT</span>
            <span className={styles.tagline} style={{ display: "block" }}>
              TRADING · POS · DISTRIBUTION
            </span>
          </span>
        </div>

        <div className={styles.pitch}>
          <h1>One ledger behind every counter, warehouse and route.</h1>
          <p>
            Stock valuation, tax and the general ledger are computed in the
            database, inside a single transaction. A document either posts
            completely or not at all.
          </p>

          <div className={styles.pillars}>
            <div className={styles.pillar}>
              <div className={styles.pillarName}>Trading</div>
              <div className={styles.pillarNote}>
                Purchase to sale with weighted-average costing
              </div>
            </div>
            <div className={styles.pillar}>
              <div className={styles.pillarName}>POS</div>
              <div className={styles.pillarNote}>
                Keeps selling when the network drops
              </div>
            </div>
            <div className={styles.pillar}>
              <div className={styles.pillarName}>Distribution</div>
              <div className={styles.pillarNote}>
                Route booking, delivery and recovery
              </div>
            </div>
          </div>
        </div>

        <p className={styles.footNote}>
          Every posting is checked against your role and your
          company/branch/warehouse scope before it is written.
        </p>
      </section>

      <section className={styles.formPane}>
        <h2>Sign in</h2>
        <p className={styles.sub}>Use your Sahulat ERP account.</p>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className={styles.hint}>
          Locked out or need access to another branch? Your administrator
          manages roles and scope — permissions cannot be self-granted.
        </p>
      </section>
    </div>
  );
}
