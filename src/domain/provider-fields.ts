import type { Resource } from "./enums";
import type { ProviderField } from "./provider.entity";

const providerFields = {
  accounts: {
    balance: {
      kind: "decimal",
    },
    "bankData.automaticallyInvestedBalance": {
      kind: "decimal",
    },
    "bankData.closingBalance": {
      kind: "decimal",
    },
    "bankData.hasReservedBalance": {
      kind: "scalar",
    },
    "bankData.overdraftContractedLimit": {
      kind: "decimal",
    },
    "bankData.overdraftUsedLimit": {
      kind: "decimal",
    },
    "bankData.reservedBalances": {
      fields: {
        availableAmounts: {
          fields: {
            amount: {
              kind: "decimal",
            },
            currencyCode: {
              kind: "scalar",
            },
            "remuneration.calculation": {
              kind: "scalar",
            },
            "remuneration.indexer": {
              kind: "scalar",
            },
            "remuneration.indexerAdditionalInfo": {
              kind: "scalar",
            },
            "remuneration.postFixedIndexerPercentage": {
              kind: "decimal",
            },
            "remuneration.preFixedRate": {
              kind: "decimal",
            },
            "remuneration.ratePeriodicity": {
              kind: "scalar",
            },
            "remuneration.rateType": {
              kind: "scalar",
            },
          },
          kind: "array",
        },
        identification: {
          kind: "scalar",
        },
        name: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "bankData.unarrangedOverdraftAmount": {
      kind: "decimal",
    },
    createdAt: {
      kind: "scalar",
    },
    "creditData.availableCreditLimit": {
      kind: "decimal",
    },
    "creditData.balanceCloseDate": {
      kind: "scalar",
    },
    "creditData.balanceDueDate": {
      kind: "scalar",
    },
    "creditData.balanceForeignCurrency": {
      kind: "decimal",
    },
    "creditData.brand": {
      kind: "scalar",
    },
    "creditData.brandAdditionalInfo": {
      kind: "scalar",
    },
    "creditData.creditLimit": {
      kind: "decimal",
    },
    "creditData.disaggregatedCreditLimits": {
      fields: {
        availableAmount: {
          kind: "decimal",
        },
        availableAmountCurrencyCode: {
          kind: "scalar",
        },
        consolidationType: {
          kind: "scalar",
        },
        creditLineLimitType: {
          kind: "scalar",
        },
        customizedLimitAmount: {
          kind: "decimal",
        },
        customizedLimitAmountCurrencyCode: {
          kind: "scalar",
        },
        identificationNumber: {
          kind: "scalar",
        },
        isLimitFlexible: {
          kind: "scalar",
        },
        limitAmount: {
          kind: "decimal",
        },
        limitAmountCurrencyCode: {
          kind: "scalar",
        },
        limitAmountReason: {
          kind: "scalar",
        },
        lineName: {
          kind: "scalar",
        },
        lineNameAdditionalInfo: {
          kind: "scalar",
        },
        usedAmount: {
          kind: "decimal",
        },
        usedAmountCurrencyCode: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "creditData.holderType": {
      kind: "scalar",
    },
    "creditData.isLimitFlexible": {
      kind: "scalar",
    },
    "creditData.level": {
      kind: "scalar",
    },
    "creditData.minimumPayment": {
      kind: "decimal",
    },
    "creditData.status": {
      kind: "scalar",
    },
    currencyCode: {
      kind: "scalar",
    },
    id: {
      kind: "scalar",
    },
    itemId: {
      kind: "scalar",
    },
    marketingName: {
      kind: "scalar",
    },
    name: {
      kind: "scalar",
    },
    subtype: {
      kind: "scalar",
    },
    type: {
      kind: "scalar",
    },
    updatedAt: {
      kind: "scalar",
    },
  },
  bills: {
    allowsInstallments: {
      kind: "scalar",
    },
    billClosingDate: {
      kind: "scalar",
    },
    dueDate: {
      kind: "scalar",
    },
    financeCharges: {
      fields: {
        additionalInfo: {
          kind: "scalar",
        },
        amount: {
          kind: "decimal",
        },
        currencyCode: {
          kind: "scalar",
        },
        id: {
          kind: "scalar",
        },
        type: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    id: {
      kind: "scalar",
    },
    minimumPaymentAmount: {
      kind: "decimal",
    },
    payments: {
      fields: {
        amount: {
          kind: "decimal",
        },
        currencyCode: {
          kind: "scalar",
        },
        id: {
          kind: "scalar",
        },
        paymentDate: {
          kind: "scalar",
        },
        paymentMode: {
          kind: "scalar",
        },
        valueType: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    totalAmount: {
      kind: "decimal",
    },
    totalAmountCurrencyCode: {
      kind: "scalar",
    },
  },
  categories: {
    description: {
      kind: "scalar",
    },
    descriptionTranslated: {
      kind: "scalar",
    },
    id: {
      kind: "scalar",
    },
    parentDescription: {
      kind: "scalar",
    },
    parentId: {
      kind: "scalar",
    },
  },
  connections: {
    "connector.country": {
      kind: "scalar",
    },
    "connector.health.details.connectionRateLast6Hours": {
      kind: "decimal",
    },
    "connector.health.details.connectionsLast6Hours": {
      kind: "decimal",
    },
    "connector.health.incidents": {
      fields: {
        id: {
          kind: "scalar",
        },
        kind: {
          kind: "scalar",
        },
        product: {
          kind: "scalar",
        },
        severity: {
          kind: "scalar",
        },
        startedAt: {
          kind: "scalar",
        },
        state: {
          kind: "scalar",
        },
        title: {
          kind: "scalar",
        },
        type: {
          kind: "scalar",
        },
        updatedAt: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "connector.health.stage": {
      kind: "scalar",
    },
    "connector.health.status": {
      kind: "scalar",
    },
    "connector.id": {
      kind: "decimal",
    },
    "connector.isOpenFinance": {
      kind: "scalar",
    },
    "connector.isSandbox": {
      kind: "scalar",
    },
    "connector.name": {
      kind: "scalar",
    },
    "connector.products": {
      kind: "array_scalar",
    },
    "connector.type": {
      kind: "scalar",
    },
    "connector.updatedAt": {
      kind: "scalar",
    },
    consentExpiresAt: {
      kind: "scalar",
    },
    createdAt: {
      kind: "scalar",
    },
    executionStatus: {
      kind: "scalar",
    },
    hasResourcesPendingAuthorization: {
      kind: "scalar",
    },
    id: {
      kind: "scalar",
    },
    lastUpdatedAt: {
      kind: "scalar",
    },
    nextAutoSyncAt: {
      kind: "scalar",
    },
    products: {
      kind: "array_scalar",
    },
    resourcesCollectedAt: {
      kind: "scalar",
    },
    status: {
      kind: "scalar",
    },
    "statusDetail.accountStatements.isUpdated": {
      kind: "scalar",
    },
    "statusDetail.accountStatements.lastUpdatedAt": {
      kind: "scalar",
    },
    "statusDetail.accountStatements.warnings": {
      fields: {
        code: {
          kind: "scalar",
        },
        message: {
          kind: "scalar",
        },
        providerMessage: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "statusDetail.accounts.isUpdated": {
      kind: "scalar",
    },
    "statusDetail.accounts.lastUpdatedAt": {
      kind: "scalar",
    },
    "statusDetail.accounts.warnings": {
      fields: {
        code: {
          kind: "scalar",
        },
        message: {
          kind: "scalar",
        },
        providerMessage: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "statusDetail.creditCards.isUpdated": {
      kind: "scalar",
    },
    "statusDetail.creditCards.lastUpdatedAt": {
      kind: "scalar",
    },
    "statusDetail.creditCards.warnings": {
      fields: {
        code: {
          kind: "scalar",
        },
        message: {
          kind: "scalar",
        },
        providerMessage: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "statusDetail.identity.isUpdated": {
      kind: "scalar",
    },
    "statusDetail.identity.lastUpdatedAt": {
      kind: "scalar",
    },
    "statusDetail.identity.warnings": {
      fields: {
        code: {
          kind: "scalar",
        },
        message: {
          kind: "scalar",
        },
        providerMessage: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "statusDetail.investments.isUpdated": {
      kind: "scalar",
    },
    "statusDetail.investments.lastUpdatedAt": {
      kind: "scalar",
    },
    "statusDetail.investments.warnings": {
      fields: {
        code: {
          kind: "scalar",
        },
        message: {
          kind: "scalar",
        },
        providerMessage: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "statusDetail.investmentsTransactions.isUpdated": {
      kind: "scalar",
    },
    "statusDetail.investmentsTransactions.lastUpdatedAt": {
      kind: "scalar",
    },
    "statusDetail.investmentsTransactions.warnings": {
      fields: {
        code: {
          kind: "scalar",
        },
        message: {
          kind: "scalar",
        },
        providerMessage: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "statusDetail.loans.isUpdated": {
      kind: "scalar",
    },
    "statusDetail.loans.lastUpdatedAt": {
      kind: "scalar",
    },
    "statusDetail.loans.warnings": {
      fields: {
        code: {
          kind: "scalar",
        },
        message: {
          kind: "scalar",
        },
        providerMessage: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "statusDetail.paymentData.isUpdated": {
      kind: "scalar",
    },
    "statusDetail.paymentData.lastUpdatedAt": {
      kind: "scalar",
    },
    "statusDetail.paymentData.warnings": {
      fields: {
        code: {
          kind: "scalar",
        },
        message: {
          kind: "scalar",
        },
        providerMessage: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    updatedAt: {
      kind: "scalar",
    },
  },
  connectors: {
    country: {
      kind: "scalar",
    },
    "health.details.connectionRateLast6Hours": {
      kind: "decimal",
    },
    "health.details.connectionsLast6Hours": {
      kind: "decimal",
    },
    "health.incidents": {
      fields: {
        id: {
          kind: "scalar",
        },
        kind: {
          kind: "scalar",
        },
        product: {
          kind: "scalar",
        },
        severity: {
          kind: "scalar",
        },
        startedAt: {
          kind: "scalar",
        },
        state: {
          kind: "scalar",
        },
        title: {
          kind: "scalar",
        },
        type: {
          kind: "scalar",
        },
        updatedAt: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "health.stage": {
      kind: "scalar",
    },
    "health.status": {
      kind: "scalar",
    },
    id: {
      kind: "decimal",
    },
    isOpenFinance: {
      kind: "scalar",
    },
    isSandbox: {
      kind: "scalar",
    },
    name: {
      kind: "scalar",
    },
    products: {
      kind: "array_scalar",
    },
    type: {
      kind: "scalar",
    },
    updatedAt: {
      kind: "scalar",
    },
  },
  consents: {
    createdAt: {
      kind: "scalar",
    },
    expiresAt: {
      kind: "scalar",
    },
    id: {
      kind: "scalar",
    },
    itemId: {
      kind: "scalar",
    },
    openFinancePermissionsGranted: {
      kind: "array_scalar",
    },
    products: {
      kind: "array_scalar",
    },
    revokedAt: {
      kind: "scalar",
    },
  },
  identity: {
    companyName: {
      kind: "scalar",
    },
    createdAt: {
      kind: "scalar",
    },
    documentType: {
      kind: "scalar",
    },
    fullName: {
      kind: "scalar",
    },
    id: {
      kind: "scalar",
    },
    investorProfile: {
      kind: "scalar",
    },
    itemId: {
      kind: "scalar",
    },
    jobTitle: {
      kind: "scalar",
    },
    updatedAt: {
      kind: "scalar",
    },
  },
  investment_transactions: {
    agreedRate: {
      kind: "decimal",
    },
    amount: {
      kind: "decimal",
    },
    brokerageNumber: {
      kind: "scalar",
    },
    date: {
      kind: "scalar",
    },
    description: {
      kind: "scalar",
    },
    "expenses.brokerageFee": {
      kind: "decimal",
    },
    "expenses.clearingFee": {
      kind: "decimal",
    },
    "expenses.custodyFee": {
      kind: "decimal",
    },
    "expenses.incomeTax": {
      kind: "decimal",
    },
    "expenses.iof": {
      kind: "decimal",
    },
    "expenses.iofProvision": {
      kind: "decimal",
    },
    "expenses.maintenanceFee": {
      kind: "decimal",
    },
    "expenses.operatingFee": {
      kind: "decimal",
    },
    "expenses.other": {
      kind: "decimal",
    },
    "expenses.serviceTax": {
      kind: "decimal",
    },
    "expenses.settlementFee": {
      kind: "decimal",
    },
    "expenses.stockExchangeFee": {
      kind: "decimal",
    },
    "expenses.tradingAssetsNoticeFee": {
      kind: "decimal",
    },
    id: {
      kind: "scalar",
    },
    indexerPercentage: {
      kind: "decimal",
    },
    movementType: {
      kind: "scalar",
    },
    netAmount: {
      kind: "decimal",
    },
    priceFactor: {
      kind: "decimal",
    },
    quantity: {
      kind: "decimal",
    },
    tradeDate: {
      kind: "scalar",
    },
    type: {
      kind: "scalar",
    },
    value: {
      kind: "decimal",
    },
  },
  investments: {
    amount: {
      kind: "decimal",
    },
    amountOriginal: {
      kind: "decimal",
    },
    amountProfit: {
      kind: "decimal",
    },
    amountWithdrawal: {
      kind: "decimal",
    },
    annualRate: {
      kind: "decimal",
    },
    balance: {
      kind: "decimal",
    },
    code: {
      kind: "scalar",
    },
    "couponPayment.additionalInfo": {
      kind: "scalar",
    },
    "couponPayment.hasCoupon": {
      kind: "scalar",
    },
    "couponPayment.periodicity": {
      kind: "scalar",
    },
    createdAt: {
      kind: "scalar",
    },
    currencyCode: {
      kind: "scalar",
    },
    date: {
      kind: "scalar",
    },
    "debtor.name": {
      kind: "scalar",
    },
    dueDate: {
      kind: "scalar",
    },
    fixedAnnualRate: {
      kind: "decimal",
    },
    gracePeriodDate: {
      kind: "scalar",
    },
    id: {
      kind: "scalar",
    },
    indexerAdditionalInfo: {
      kind: "scalar",
    },
    "institution.name": {
      kind: "scalar",
    },
    isin: {
      kind: "scalar",
    },
    issueDate: {
      kind: "scalar",
    },
    issuer: {
      kind: "scalar",
    },
    issuerCNPJ: {
      kind: "scalar",
    },
    itemId: {
      kind: "scalar",
    },
    lastMonthRate: {
      kind: "decimal",
    },
    lastTwelveMonthsRate: {
      kind: "decimal",
    },
    "metadata.anbimaCategory": {
      kind: "scalar",
    },
    "metadata.anbimaClass": {
      kind: "scalar",
    },
    "metadata.anbimaSubclass": {
      kind: "scalar",
    },
    "metadata.fundName": {
      kind: "scalar",
    },
    "metadata.insurer.cnpj": {
      kind: "scalar",
    },
    "metadata.insurer.name": {
      kind: "scalar",
    },
    "metadata.taxRegime": {
      kind: "scalar",
    },
    name: {
      kind: "scalar",
    },
    priceFactor: {
      kind: "decimal",
    },
    purchaseDate: {
      kind: "scalar",
    },
    quantity: {
      kind: "decimal",
    },
    rate: {
      kind: "decimal",
    },
    ratePeriodicity: {
      kind: "scalar",
    },
    rateType: {
      kind: "scalar",
    },
    status: {
      kind: "scalar",
    },
    subtype: {
      kind: "scalar",
    },
    taxExempt: {
      kind: "scalar",
    },
    taxes: {
      kind: "decimal",
    },
    taxes2: {
      kind: "decimal",
    },
    type: {
      kind: "scalar",
    },
    updatedAt: {
      kind: "scalar",
    },
    value: {
      kind: "decimal",
    },
  },
  loans: {
    amortizationScheduled: {
      kind: "scalar",
    },
    amortizationScheduledAdditionalInfo: {
      kind: "scalar",
    },
    CET: {
      kind: "decimal",
    },
    cnpjConsignee: {
      kind: "scalar",
    },
    contractAmount: {
      kind: "decimal",
    },
    contractDate: {
      kind: "scalar",
    },
    contractedFees: {
      fields: {
        amount: {
          kind: "decimal",
        },
        charge: {
          kind: "scalar",
        },
        chargeType: {
          kind: "scalar",
        },
        code: {
          kind: "scalar",
        },
        name: {
          kind: "scalar",
        },
        rate: {
          kind: "decimal",
        },
      },
      kind: "array",
    },
    contractedFinanceCharges: {
      fields: {
        additionalInfo: {
          kind: "scalar",
        },
        rate: {
          kind: "decimal",
        },
        type: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    currencyCode: {
      kind: "scalar",
    },
    date: {
      kind: "scalar",
    },
    disbursementDates: {
      kind: "array_scalar",
    },
    dueDate: {
      kind: "scalar",
    },
    firstInstallmentDueDate: {
      kind: "scalar",
    },
    id: {
      kind: "scalar",
    },
    installmentPeriodicity: {
      kind: "scalar",
    },
    installmentPeriodicityAdditionalInfo: {
      kind: "scalar",
    },
    "installments.balloonPayments": {
      fields: {
        "amount.currencyCode": {
          kind: "scalar",
        },
        "amount.value": {
          kind: "decimal",
        },
        dueDate: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    "installments.contractRemainingNumber": {
      kind: "decimal",
    },
    "installments.dueInstallments": {
      kind: "decimal",
    },
    "installments.paidInstallments": {
      kind: "decimal",
    },
    "installments.pastDueInstallments": {
      kind: "decimal",
    },
    "installments.totalNumberOfInstallments": {
      kind: "decimal",
    },
    "installments.typeContractRemaining": {
      kind: "scalar",
    },
    "installments.typeNumberOfInstallments": {
      kind: "scalar",
    },
    interestRates: {
      fields: {
        additionalInfo: {
          kind: "scalar",
        },
        calculation: {
          kind: "scalar",
        },
        interestRateType: {
          kind: "scalar",
        },
        postFixedRate: {
          kind: "decimal",
        },
        preFixedRate: {
          kind: "decimal",
        },
        referentialRateIndexerAdditionalInfo: {
          kind: "scalar",
        },
        referentialRateIndexerSubType: {
          kind: "scalar",
        },
        referentialRateIndexerType: {
          kind: "scalar",
        },
        taxPeriodicity: {
          kind: "scalar",
        },
        taxType: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    itemId: {
      kind: "scalar",
    },
    kind: {
      kind: "scalar",
    },
    "payments.contractOutstandingBalance": {
      kind: "decimal",
    },
    "payments.releases": {
      fields: {
        currencyCode: {
          kind: "scalar",
        },
        installmentId: {
          kind: "scalar",
        },
        isOverParcelPayment: {
          kind: "scalar",
        },
        "overParcel.charges": {
          fields: {
            additionalInfo: {
              kind: "scalar",
            },
            amount: {
              kind: "decimal",
            },
            type: {
              kind: "scalar",
            },
          },
          kind: "array",
        },
        "overParcel.fees": {
          fields: {
            amount: {
              kind: "decimal",
            },
            code: {
              kind: "scalar",
            },
            name: {
              kind: "scalar",
            },
          },
          kind: "array",
        },
        paidAmount: {
          kind: "decimal",
        },
        paidDate: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
    productName: {
      kind: "scalar",
    },
    settlementDate: {
      kind: "scalar",
    },
    type: {
      kind: "scalar",
    },
    warranties: {
      fields: {
        amount: {
          kind: "decimal",
        },
        currencyCode: {
          kind: "scalar",
        },
        subtype: {
          kind: "scalar",
        },
        type: {
          kind: "scalar",
        },
      },
      kind: "array",
    },
  },
  resources: {
    id: {
      kind: "scalar",
    },
    resourceId: {
      kind: "scalar",
    },
    status: {
      kind: "scalar",
    },
    type: {
      kind: "scalar",
    },
  },
  statements: {
    id: {
      kind: "scalar",
    },
    monthYear: {
      kind: "scalar",
    },
  },
  transactions: {
    accountId: {
      kind: "scalar",
    },
    amount: {
      kind: "decimal",
    },
    amountInAccountCurrency: {
      kind: "decimal",
    },
    balance: {
      kind: "decimal",
    },
    category: {
      kind: "scalar",
    },
    categoryId: {
      kind: "scalar",
    },
    createdAt: {
      kind: "scalar",
    },
    "creditCardMetadata.billForecastDate": {
      kind: "scalar",
    },
    "creditCardMetadata.billId": {
      kind: "scalar",
    },
    "creditCardMetadata.billPostDate": {
      kind: "scalar",
    },
    "creditCardMetadata.feeType": {
      kind: "scalar",
    },
    "creditCardMetadata.feeTypeAdditionalInfo": {
      kind: "scalar",
    },
    "creditCardMetadata.installmentNumber": {
      kind: "decimal",
    },
    "creditCardMetadata.otherCreditsAdditionalInfo": {
      kind: "scalar",
    },
    "creditCardMetadata.otherCreditsType": {
      kind: "scalar",
    },
    "creditCardMetadata.payeeMCC": {
      kind: "scalar",
    },
    "creditCardMetadata.paymentType": {
      kind: "scalar",
    },
    "creditCardMetadata.purchaseDate": {
      kind: "scalar",
    },
    "creditCardMetadata.totalAmount": {
      kind: "decimal",
    },
    "creditCardMetadata.totalInstallments": {
      kind: "decimal",
    },
    "creditCardMetadata.transactionDateTime": {
      kind: "scalar",
    },
    currencyCode: {
      kind: "scalar",
    },
    date: {
      kind: "scalar",
    },
    description: {
      kind: "scalar",
    },
    descriptionRaw: {
      kind: "scalar",
    },
    id: {
      kind: "scalar",
    },
    "merchant.businessName": {
      kind: "scalar",
    },
    "merchant.category": {
      kind: "scalar",
    },
    "merchant.cnae": {
      kind: "scalar",
    },
    "merchant.cnpj": {
      kind: "scalar",
    },
    "merchant.name": {
      kind: "scalar",
    },
    operationType: {
      kind: "scalar",
    },
    operationTypeAdditionalInfo: {
      kind: "scalar",
    },
    order: {
      kind: "decimal",
    },
    "paymentData.boletoMetadata.baseAmount": {
      kind: "decimal",
    },
    "paymentData.boletoMetadata.discountAmount": {
      kind: "decimal",
    },
    "paymentData.boletoMetadata.interestAmount": {
      kind: "decimal",
    },
    "paymentData.boletoMetadata.penaltyAmount": {
      kind: "decimal",
    },
    "paymentData.payer.name": {
      kind: "scalar",
    },
    "paymentData.payer.routingNumber": {
      kind: "scalar",
    },
    "paymentData.payer.routingNumberISPB": {
      kind: "scalar",
    },
    "paymentData.paymentMethod": {
      kind: "scalar",
    },
    "paymentData.reason": {
      kind: "scalar",
    },
    "paymentData.receiver.name": {
      kind: "scalar",
    },
    "paymentData.receiver.routingNumber": {
      kind: "scalar",
    },
    "paymentData.receiver.routingNumberISPB": {
      kind: "scalar",
    },
    "paymentData.receiverReferenceId": {
      kind: "scalar",
    },
    "paymentData.referenceNumber": {
      kind: "scalar",
    },
    providerCode: {
      kind: "scalar",
    },
    providerId: {
      kind: "scalar",
    },
    status: {
      kind: "scalar",
    },
    type: {
      kind: "scalar",
    },
    updatedAt: {
      kind: "scalar",
    },
  },
} as const satisfies Record<Resource, Record<string, ProviderField>>;

export default providerFields;
