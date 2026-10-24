import type {
  TransactionIdentification,
  TransactionParticipant,
} from "../../domain";
import { formatBalance } from "../money";

type Field = readonly [string, string | number | null | undefined];

function IdentificationSection({
  title,
  fields,
}: {
  title: string;
  fields: readonly Field[];
}) {
  const visible = fields.filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (!visible.length) {
    return null;
  }
  return (
    <section
      aria-label={title}
      className="transaction-source-details"
    >
      <h3>{title}</h3>
      <dl className="transaction-detail">
        {visible.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Participant({
  title,
  participant,
}: {
  title: string;
  participant: TransactionParticipant | null | undefined;
}) {
  if (!participant) {
    return null;
  }
  return (
    <IdentificationSection
      fields={[
        ["Nome", participant.name],
        [
          participant.documentNumber?.type ?? "Documento",
          participant.documentNumber?.value,
        ],
        ["Agência", participant.branchNumber],
        ["Número da conta", participant.accountNumber],
        ["Banco (COMPE)", participant.routingNumber],
        ["Banco (ISPB)", participant.routingNumberISPB],
      ]}
      title={title}
    />
  );
}

export function TransactionIdentificationDetails({
  identification,
  currency,
}: {
  identification: TransactionIdentification | null | undefined;
  currency: string;
}) {
  if (!identification) {
    return null;
  }
  const {
    merchant,
    paymentData: payment,
    creditCardMetadata: card,
  } = identification;
  const boleto = payment?.boletoMetadata;
  const money = (value: string | null | undefined) =>
    value === null || value === undefined
      ? value
      : formatBalance(value, currency);
  return (
    <>
      {!!merchant && (
        <IdentificationSection
          fields={[
            ["Nome comercial", merchant.name],
            ["Razão social", merchant.businessName],
            ["CNPJ", merchant.cnpj],
            ["CNAE", merchant.cnae],
            ["Ramo informado", merchant.category],
          ]}
          title="Estabelecimento"
        />
      )}
      <IdentificationSection
        fields={[
          ["Descrição original", identification.descriptionRaw],
          ["Data informada pela origem", identification.date],
          ["Categoria da origem", identification.category],
          ["Código da categoria", identification.categoryId],
          ["Tipo de operação", identification.operationType],
          [
            "Informação da operação",
            identification.operationTypeAdditionalInfo,
          ],
          ["Identificador na instituição", identification.providerId],
          ["Código da instituição", identification.providerCode],
          ["Ordem no dia", identification.order],
          ["Recebida pela Pluggy em", identification.createdAt],
          ["Atualizada na Pluggy em", identification.updatedAt],
        ]}
        title="Identificação na origem"
      />
      <IdentificationSection
        fields={[
          [
            "Valor da transação na conta",
            identification.amountInAccountCurrency,
          ],
          ["Saldo após o lançamento", identification.balance],
        ]}
        title="Valores na moeda da conta"
      />
      {!!payment && (
        <IdentificationSection
          fields={[
            ["Método", payment.paymentMethod],
            ["Motivo", payment.reason],
            ["Referência", payment.referenceNumber],
            ["Referência do recebedor", payment.receiverReferenceId],
            ["Autenticação", payment.authenticationCode],
          ]}
          title="Pagamento"
        />
      )}
      <Participant
        participant={payment?.payer}
        title="Pagador"
      />
      <Participant
        participant={payment?.receiver}
        title="Recebedor"
      />
      {!!boleto && (
        <IdentificationSection
          fields={[
            ["Linha digitável", boleto.digitableLine],
            ["Código de barras", boleto.barcode],
            ["Valor original", money(boleto.baseAmountMinor)],
            ["Juros", money(boleto.interestAmountMinor)],
            ["Multa", money(boleto.penaltyAmountMinor)],
            ["Desconto", money(boleto.discountAmountMinor)],
          ]}
          title="Boleto"
        />
      )}
      {!!card && (
        <IdentificationSection
          fields={[
            ["Final do cartão", card.cardNumber],
            ["MCC do estabelecimento", card.payeeMCC],
            ["Data da compra", card.purchaseDate],
            ["Data e hora na instituição", card.transactionDateTime],
            ["Forma de pagamento", card.paymentType],
            ["Parcela", card.installmentNumber],
            ["Total de parcelas", card.totalInstallments],
            ["Valor total da compra", money(card.totalAmountMinor)],
            ["Identificador da fatura", card.billId],
            ["Previsão da fatura", card.billForecastDate],
            ["Lançada na fatura em", card.billPostDate],
            ["Tipo de tarifa", card.feeType],
            ["Descrição da tarifa", card.feeTypeAdditionalInfo],
            ["Tipo de crédito", card.otherCreditsType],
            ["Descrição do crédito", card.otherCreditsAdditionalInfo],
          ]}
          title="Dados do cartão na origem"
        />
      )}
    </>
  );
}
