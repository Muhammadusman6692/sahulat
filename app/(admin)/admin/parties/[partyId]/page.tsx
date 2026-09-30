import { notFound } from "next/navigation";
import { requirePermission, requireScope } from "@/lib/dal";
import { getParty } from "@/lib/db/parties";
import { getCompany } from "@/lib/db/companies";
import PartyForm from "../party-form";
import BackLink from "@/components/back-link/back-link";
import styles from "@/components/data-grid/grid.module.css";

export const metadata = { title: "Edit party · Sahulat ERP" };

export default async function EditPartyPage({
  params,
}: PageProps<"/admin/parties/[partyId]">) {
  await requirePermission("PARTY_MAINT", "EDIT");

  const { partyId } = await params;
  const id = Number(partyId);
  if (!Number.isInteger(id)) notFound();

  const party = await getParty(id);
  if (!party) notFound();

  // Stops a party in another company being edited by guessing its id.
  await requireScope(party.COMPANY_ID);

  const company = await getCompany(party.COMPANY_ID);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.grow}>
          <BackLink href="/admin/parties">Parties</BackLink>
          <h1 className={styles.title} style={{ marginTop: 4 }}>
            {party.PARTY_CODE} — {party.PARTY_NAME}
          </h1>
          <p className={styles.subtitle}>
            {company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
          </p>
        </div>
      </div>

      <PartyForm
        party={party}
        companyLabel={company ? `${company.COMPANY_CODE} — ${company.COMPANY_NAME}` : ""}
      />
    </div>
  );
}
