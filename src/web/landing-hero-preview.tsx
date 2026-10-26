import { Badge } from "@cloudflare/kumo/components/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { ArrowRightIcon, BankIcon } from "@phosphor-icons/react";

import { institutionLogoUrl } from "../domain";
import { demoAccounts, demoLedger } from "../fixtures/finance";
import { formatBalance } from "./money";

const previewRows = demoLedger
  .filter(
    (row) =>
      row.date.startsWith("2026-10") &&
      ["Mercado e feira", "Transferência recebida", "Farmácia"].includes(
        row.description,
      ),
  )
  .toSorted((a, b) => b.date.localeCompare(a.date));

export function LandingHeroPreview() {
  return (
    <LayerCard className="hero-preview">
      <header className="hero-preview-heading">
        <span>Caderninho</span>
        <Badge variant="secondary">Demo</Badge>
      </header>
      <div className="hero-preview-period">
        <h2>Transações recentes</h2>
        <span>outubro de 2026</span>
      </div>
      <ul className="hero-preview-records">
        {previewRows.map((row) => {
          const account = demoAccounts.find(
            (item) => item.id === row.accountId,
          );
          const logo = institutionLogoUrl(
            account?.identity?.institution?.logoUrl,
          );
          return (
            <li key={row.id}>
              <span className="hero-preview-bank">
                {logo ? (
                  <img
                    alt=""
                    height={32}
                    referrerPolicy="no-referrer"
                    src={logo}
                    width={32}
                  />
                ) : (
                  <BankIcon
                    aria-hidden
                    size={20}
                  />
                )}
              </span>
              <span className="hero-preview-description">
                <strong>{row.description}</strong>
                <span>{account?.name}</span>
              </span>
              <span
                className="hero-preview-amount"
                data-direction={row.direction}
              >
                {row.direction === "CREDIT" ? "+" : ""}
                {formatBalance(row.amountMinor, row.currency)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="hero-preview-question">
        <span>No seu agente</span>
        <p>“Como mudaram meus gastos com mercado?”</p>
      </div>
      <a
        className="hero-preview-link"
        href="/demo?month=2026-10"
      >
        Abrir o painel de exemplo{" "}
        <ArrowRightIcon
          aria-hidden
          size={18}
        />
      </a>
    </LayerCard>
  );
}
