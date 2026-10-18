import type { Resource } from "#domain/enums.ts";
import type { ProviderField } from "#domain/provider.types.ts";

const providerFields = {
  "accounts": {
    "id": {
      "kind": "scalar"
    },
    "type": {
      "kind": "scalar"
    },
    "subtype": {
      "kind": "scalar"
    },
    "name": {
      "kind": "scalar"
    },
    "marketingName": {
      "kind": "scalar"
    },
    "balance": {
      "kind": "decimal"
    },
    "itemId": {
      "kind": "scalar"
    },
    "currencyCode": {
      "kind": "scalar"
    },
    "bankData.closingBalance": {
      "kind": "decimal"
    },
    "bankData.automaticallyInvestedBalance": {
      "kind": "decimal"
    },
    "bankData.overdraftContractedLimit": {
      "kind": "decimal"
    },
    "bankData.overdraftUsedLimit": {
      "kind": "decimal"
    },
    "bankData.unarrangedOverdraftAmount": {
      "kind": "decimal"
    },
    "bankData.hasReservedBalance": {
      "kind": "scalar"
    },
    "bankData.reservedBalances": {
      "kind": "array",
      "fields": {
        "name": {
          "kind": "scalar"
        },
        "identification": {
          "kind": "scalar"
        },
        "availableAmounts": {
          "kind": "array",
          "fields": {
            "amount": {
              "kind": "decimal"
            },
            "currencyCode": {
              "kind": "scalar"
            },
            "remuneration.preFixedRate": {
              "kind": "decimal"
            },
            "remuneration.postFixedIndexerPercentage": {
              "kind": "decimal"
            },
            "remuneration.rateType": {
              "kind": "scalar"
            },
            "remuneration.indexer": {
              "kind": "scalar"
            },
            "remuneration.calculation": {
              "kind": "scalar"
            },
            "remuneration.ratePeriodicity": {
              "kind": "scalar"
            },
            "remuneration.indexerAdditionalInfo": {
              "kind": "scalar"
            }
          }
        }
      }
    },
    "creditData.level": {
      "kind": "scalar"
    },
    "creditData.brand": {
      "kind": "scalar"
    },
    "creditData.brandAdditionalInfo": {
      "kind": "scalar"
    },
    "creditData.balanceCloseDate": {
      "kind": "scalar"
    },
    "creditData.balanceDueDate": {
      "kind": "scalar"
    },
    "creditData.availableCreditLimit": {
      "kind": "decimal"
    },
    "creditData.balanceForeignCurrency": {
      "kind": "decimal"
    },
    "creditData.minimumPayment": {
      "kind": "decimal"
    },
    "creditData.creditLimit": {
      "kind": "decimal"
    },
    "creditData.isLimitFlexible": {
      "kind": "scalar"
    },
    "creditData.status": {
      "kind": "scalar"
    },
    "creditData.holderType": {
      "kind": "scalar"
    },
    "creditData.disaggregatedCreditLimits": {
      "kind": "array",
      "fields": {
        "creditLineLimitType": {
          "kind": "scalar"
        },
        "consolidationType": {
          "kind": "scalar"
        },
        "identificationNumber": {
          "kind": "scalar"
        },
        "isLimitFlexible": {
          "kind": "scalar"
        },
        "usedAmount": {
          "kind": "decimal"
        },
        "usedAmountCurrencyCode": {
          "kind": "scalar"
        },
        "lineName": {
          "kind": "scalar"
        },
        "lineNameAdditionalInfo": {
          "kind": "scalar"
        },
        "limitAmount": {
          "kind": "decimal"
        },
        "limitAmountCurrencyCode": {
          "kind": "scalar"
        },
        "limitAmountReason": {
          "kind": "scalar"
        },
        "customizedLimitAmount": {
          "kind": "decimal"
        },
        "customizedLimitAmountCurrencyCode": {
          "kind": "scalar"
        },
        "availableAmount": {
          "kind": "decimal"
        },
        "availableAmountCurrencyCode": {
          "kind": "scalar"
        }
      }
    },
    "createdAt": {
      "kind": "scalar"
    },
    "updatedAt": {
      "kind": "scalar"
    }
  },
  "transactions": {
    "id": {
      "kind": "scalar"
    },
    "description": {
      "kind": "scalar"
    },
    "descriptionRaw": {
      "kind": "scalar"
    },
    "currencyCode": {
      "kind": "scalar"
    },
    "amount": {
      "kind": "decimal"
    },
    "amountInAccountCurrency": {
      "kind": "decimal"
    },
    "date": {
      "kind": "scalar"
    },
    "type": {
      "kind": "scalar"
    },
    "balance": {
      "kind": "decimal"
    },
    "providerCode": {
      "kind": "scalar"
    },
    "status": {
      "kind": "scalar"
    },
    "category": {
      "kind": "scalar"
    },
    "categoryId": {
      "kind": "scalar"
    },
    "paymentData.payer.name": {
      "kind": "scalar"
    },
    "paymentData.payer.routingNumber": {
      "kind": "scalar"
    },
    "paymentData.payer.routingNumberISPB": {
      "kind": "scalar"
    },
    "paymentData.receiver.name": {
      "kind": "scalar"
    },
    "paymentData.receiver.routingNumber": {
      "kind": "scalar"
    },
    "paymentData.receiver.routingNumberISPB": {
      "kind": "scalar"
    },
    "paymentData.reason": {
      "kind": "scalar"
    },
    "paymentData.referenceNumber": {
      "kind": "scalar"
    },
    "paymentData.receiverReferenceId": {
      "kind": "scalar"
    },
    "paymentData.paymentMethod": {
      "kind": "scalar"
    },
    "paymentData.boletoMetadata.baseAmount": {
      "kind": "decimal"
    },
    "paymentData.boletoMetadata.interestAmount": {
      "kind": "decimal"
    },
    "paymentData.boletoMetadata.penaltyAmount": {
      "kind": "decimal"
    },
    "paymentData.boletoMetadata.discountAmount": {
      "kind": "decimal"
    },
    "creditCardMetadata.installmentNumber": {
      "kind": "decimal"
    },
    "creditCardMetadata.totalInstallments": {
      "kind": "decimal"
    },
    "creditCardMetadata.totalAmount": {
      "kind": "decimal"
    },
    "creditCardMetadata.feeType": {
      "kind": "scalar"
    },
    "creditCardMetadata.feeTypeAdditionalInfo": {
      "kind": "scalar"
    },
    "creditCardMetadata.otherCreditsType": {
      "kind": "scalar"
    },
    "creditCardMetadata.otherCreditsAdditionalInfo": {
      "kind": "scalar"
    },
    "creditCardMetadata.purchaseDate": {
      "kind": "scalar"
    },
    "creditCardMetadata.payeeMCC": {
      "kind": "scalar"
    },
    "creditCardMetadata.billId": {
      "kind": "scalar"
    },
    "creditCardMetadata.billForecastDate": {
      "kind": "scalar"
    },
    "creditCardMetadata.paymentType": {
      "kind": "scalar"
    },
    "creditCardMetadata.billPostDate": {
      "kind": "scalar"
    },
    "creditCardMetadata.transactionDateTime": {
      "kind": "scalar"
    },
    "merchant.name": {
      "kind": "scalar"
    },
    "merchant.businessName": {
      "kind": "scalar"
    },
    "merchant.cnpj": {
      "kind": "scalar"
    },
    "merchant.cnae": {
      "kind": "scalar"
    },
    "merchant.category": {
      "kind": "scalar"
    },
    "operationType": {
      "kind": "scalar"
    },
    "operationTypeAdditionalInfo": {
      "kind": "scalar"
    },
    "providerId": {
      "kind": "scalar"
    },
    "accountId": {
      "kind": "scalar"
    },
    "order": {
      "kind": "decimal"
    },
    "createdAt": {
      "kind": "scalar"
    },
    "updatedAt": {
      "kind": "scalar"
    }
  },
  "investments": {
    "id": {
      "kind": "scalar"
    },
    "itemId": {
      "kind": "scalar"
    },
    "type": {
      "kind": "scalar"
    },
    "subtype": {
      "kind": "scalar"
    },
    "balance": {
      "kind": "decimal"
    },
    "name": {
      "kind": "scalar"
    },
    "lastMonthRate": {
      "kind": "decimal"
    },
    "lastTwelveMonthsRate": {
      "kind": "decimal"
    },
    "annualRate": {
      "kind": "decimal"
    },
    "currencyCode": {
      "kind": "scalar"
    },
    "code": {
      "kind": "scalar"
    },
    "isin": {
      "kind": "scalar"
    },
    "value": {
      "kind": "decimal"
    },
    "quantity": {
      "kind": "decimal"
    },
    "amount": {
      "kind": "decimal"
    },
    "taxes": {
      "kind": "decimal"
    },
    "taxes2": {
      "kind": "decimal"
    },
    "date": {
      "kind": "scalar"
    },
    "amountProfit": {
      "kind": "decimal"
    },
    "amountWithdrawal": {
      "kind": "decimal"
    },
    "amountOriginal": {
      "kind": "decimal"
    },
    "metadata.taxRegime": {
      "kind": "scalar"
    },
    "metadata.fundName": {
      "kind": "scalar"
    },
    "metadata.insurer.name": {
      "kind": "scalar"
    },
    "metadata.insurer.cnpj": {
      "kind": "scalar"
    },
    "metadata.anbimaClass": {
      "kind": "scalar"
    },
    "metadata.anbimaSubclass": {
      "kind": "scalar"
    },
    "metadata.anbimaCategory": {
      "kind": "scalar"
    },
    "dueDate": {
      "kind": "scalar"
    },
    "issuer": {
      "kind": "scalar"
    },
    "issuerCNPJ": {
      "kind": "scalar"
    },
    "issueDate": {
      "kind": "scalar"
    },
    "purchaseDate": {
      "kind": "scalar"
    },
    "gracePeriodDate": {
      "kind": "scalar"
    },
    "rate": {
      "kind": "decimal"
    },
    "rateType": {
      "kind": "scalar"
    },
    "fixedAnnualRate": {
      "kind": "decimal"
    },
    "taxExempt": {
      "kind": "scalar"
    },
    "ratePeriodicity": {
      "kind": "scalar"
    },
    "indexerAdditionalInfo": {
      "kind": "scalar"
    },
    "priceFactor": {
      "kind": "decimal"
    },
    "debtor.name": {
      "kind": "scalar"
    },
    "couponPayment.hasCoupon": {
      "kind": "scalar"
    },
    "couponPayment.periodicity": {
      "kind": "scalar"
    },
    "couponPayment.additionalInfo": {
      "kind": "scalar"
    },
    "status": {
      "kind": "scalar"
    },
    "createdAt": {
      "kind": "scalar"
    },
    "updatedAt": {
      "kind": "scalar"
    },
    "institution.name": {
      "kind": "scalar"
    }
  },
  "investment_transactions": {
    "id": {
      "kind": "scalar"
    },
    "type": {
      "kind": "scalar"
    },
    "movementType": {
      "kind": "scalar"
    },
    "quantity": {
      "kind": "decimal"
    },
    "value": {
      "kind": "decimal"
    },
    "amount": {
      "kind": "decimal"
    },
    "agreedRate": {
      "kind": "decimal"
    },
    "indexerPercentage": {
      "kind": "decimal"
    },
    "priceFactor": {
      "kind": "decimal"
    },
    "date": {
      "kind": "scalar"
    },
    "tradeDate": {
      "kind": "scalar"
    },
    "expenses.serviceTax": {
      "kind": "decimal"
    },
    "expenses.brokerageFee": {
      "kind": "decimal"
    },
    "expenses.incomeTax": {
      "kind": "decimal"
    },
    "expenses.tradingAssetsNoticeFee": {
      "kind": "decimal"
    },
    "expenses.maintenanceFee": {
      "kind": "decimal"
    },
    "expenses.settlementFee": {
      "kind": "decimal"
    },
    "expenses.clearingFee": {
      "kind": "decimal"
    },
    "expenses.stockExchangeFee": {
      "kind": "decimal"
    },
    "expenses.custodyFee": {
      "kind": "decimal"
    },
    "expenses.operatingFee": {
      "kind": "decimal"
    },
    "expenses.other": {
      "kind": "decimal"
    },
    "expenses.iof": {
      "kind": "decimal"
    },
    "expenses.iofProvision": {
      "kind": "decimal"
    },
    "description": {
      "kind": "scalar"
    },
    "netAmount": {
      "kind": "decimal"
    },
    "brokerageNumber": {
      "kind": "scalar"
    }
  },
  "bills": {
    "id": {
      "kind": "scalar"
    },
    "dueDate": {
      "kind": "scalar"
    },
    "billClosingDate": {
      "kind": "scalar"
    },
    "totalAmount": {
      "kind": "decimal"
    },
    "totalAmountCurrencyCode": {
      "kind": "scalar"
    },
    "minimumPaymentAmount": {
      "kind": "decimal"
    },
    "allowsInstallments": {
      "kind": "scalar"
    },
    "financeCharges": {
      "kind": "array",
      "fields": {
        "id": {
          "kind": "scalar"
        },
        "type": {
          "kind": "scalar"
        },
        "amount": {
          "kind": "decimal"
        },
        "currencyCode": {
          "kind": "scalar"
        },
        "additionalInfo": {
          "kind": "scalar"
        }
      }
    },
    "payments": {
      "kind": "array",
      "fields": {
        "id": {
          "kind": "scalar"
        },
        "valueType": {
          "kind": "scalar"
        },
        "paymentDate": {
          "kind": "scalar"
        },
        "paymentMode": {
          "kind": "scalar"
        },
        "amount": {
          "kind": "decimal"
        },
        "currencyCode": {
          "kind": "scalar"
        }
      }
    }
  },
  "loans": {
    "id": {
      "kind": "scalar"
    },
    "itemId": {
      "kind": "scalar"
    },
    "productName": {
      "kind": "scalar"
    },
    "type": {
      "kind": "scalar"
    },
    "kind": {
      "kind": "scalar"
    },
    "date": {
      "kind": "scalar"
    },
    "contractDate": {
      "kind": "scalar"
    },
    "disbursementDates": {
      "kind": "array_scalar"
    },
    "settlementDate": {
      "kind": "scalar"
    },
    "contractAmount": {
      "kind": "decimal"
    },
    "currencyCode": {
      "kind": "scalar"
    },
    "dueDate": {
      "kind": "scalar"
    },
    "installmentPeriodicity": {
      "kind": "scalar"
    },
    "installmentPeriodicityAdditionalInfo": {
      "kind": "scalar"
    },
    "firstInstallmentDueDate": {
      "kind": "scalar"
    },
    "CET": {
      "kind": "decimal"
    },
    "amortizationScheduled": {
      "kind": "scalar"
    },
    "amortizationScheduledAdditionalInfo": {
      "kind": "scalar"
    },
    "cnpjConsignee": {
      "kind": "scalar"
    },
    "interestRates": {
      "kind": "array",
      "fields": {
        "taxType": {
          "kind": "scalar"
        },
        "interestRateType": {
          "kind": "scalar"
        },
        "taxPeriodicity": {
          "kind": "scalar"
        },
        "calculation": {
          "kind": "scalar"
        },
        "referentialRateIndexerType": {
          "kind": "scalar"
        },
        "referentialRateIndexerSubType": {
          "kind": "scalar"
        },
        "referentialRateIndexerAdditionalInfo": {
          "kind": "scalar"
        },
        "preFixedRate": {
          "kind": "decimal"
        },
        "postFixedRate": {
          "kind": "decimal"
        },
        "additionalInfo": {
          "kind": "scalar"
        }
      }
    },
    "contractedFees": {
      "kind": "array",
      "fields": {
        "name": {
          "kind": "scalar"
        },
        "code": {
          "kind": "scalar"
        },
        "chargeType": {
          "kind": "scalar"
        },
        "charge": {
          "kind": "scalar"
        },
        "amount": {
          "kind": "decimal"
        },
        "rate": {
          "kind": "decimal"
        }
      }
    },
    "contractedFinanceCharges": {
      "kind": "array",
      "fields": {
        "type": {
          "kind": "scalar"
        },
        "additionalInfo": {
          "kind": "scalar"
        },
        "rate": {
          "kind": "decimal"
        }
      }
    },
    "warranties": {
      "kind": "array",
      "fields": {
        "currencyCode": {
          "kind": "scalar"
        },
        "type": {
          "kind": "scalar"
        },
        "subtype": {
          "kind": "scalar"
        },
        "amount": {
          "kind": "decimal"
        }
      }
    },
    "installments.typeNumberOfInstallments": {
      "kind": "scalar"
    },
    "installments.totalNumberOfInstallments": {
      "kind": "decimal"
    },
    "installments.typeContractRemaining": {
      "kind": "scalar"
    },
    "installments.contractRemainingNumber": {
      "kind": "decimal"
    },
    "installments.paidInstallments": {
      "kind": "decimal"
    },
    "installments.dueInstallments": {
      "kind": "decimal"
    },
    "installments.pastDueInstallments": {
      "kind": "decimal"
    },
    "installments.balloonPayments": {
      "kind": "array",
      "fields": {
        "dueDate": {
          "kind": "scalar"
        },
        "amount.value": {
          "kind": "decimal"
        },
        "amount.currencyCode": {
          "kind": "scalar"
        }
      }
    },
    "payments.contractOutstandingBalance": {
      "kind": "decimal"
    },
    "payments.releases": {
      "kind": "array",
      "fields": {
        "isOverParcelPayment": {
          "kind": "scalar"
        },
        "installmentId": {
          "kind": "scalar"
        },
        "paidDate": {
          "kind": "scalar"
        },
        "currencyCode": {
          "kind": "scalar"
        },
        "paidAmount": {
          "kind": "decimal"
        },
        "overParcel.fees": {
          "kind": "array",
          "fields": {
            "name": {
              "kind": "scalar"
            },
            "code": {
              "kind": "scalar"
            },
            "amount": {
              "kind": "decimal"
            }
          }
        },
        "overParcel.charges": {
          "kind": "array",
          "fields": {
            "type": {
              "kind": "scalar"
            },
            "additionalInfo": {
              "kind": "scalar"
            },
            "amount": {
              "kind": "decimal"
            }
          }
        }
      }
    }
  },
  "identity": {
    "id": {
      "kind": "scalar"
    },
    "itemId": {
      "kind": "scalar"
    },
    "documentType": {
      "kind": "scalar"
    },
    "jobTitle": {
      "kind": "scalar"
    },
    "fullName": {
      "kind": "scalar"
    },
    "companyName": {
      "kind": "scalar"
    },
    "investorProfile": {
      "kind": "scalar"
    },
    "createdAt": {
      "kind": "scalar"
    },
    "updatedAt": {
      "kind": "scalar"
    }
  },
  "connections": {
    "id": {
      "kind": "scalar"
    },
    "connector.id": {
      "kind": "decimal"
    },
    "connector.name": {
      "kind": "scalar"
    },
    "connector.type": {
      "kind": "scalar"
    },
    "connector.country": {
      "kind": "scalar"
    },
    "connector.products": {
      "kind": "array_scalar"
    },
    "connector.health.status": {
      "kind": "scalar"
    },
    "connector.health.stage": {
      "kind": "scalar"
    },
    "connector.health.incidents": {
      "kind": "array",
      "fields": {
        "id": {
          "kind": "scalar"
        },
        "title": {
          "kind": "scalar"
        },
        "type": {
          "kind": "scalar"
        },
        "product": {
          "kind": "scalar"
        },
        "kind": {
          "kind": "scalar"
        },
        "severity": {
          "kind": "scalar"
        },
        "state": {
          "kind": "scalar"
        },
        "startedAt": {
          "kind": "scalar"
        },
        "updatedAt": {
          "kind": "scalar"
        }
      }
    },
    "connector.health.details.connectionRateLast6Hours": {
      "kind": "decimal"
    },
    "connector.health.details.connectionsLast6Hours": {
      "kind": "decimal"
    },
    "connector.isOpenFinance": {
      "kind": "scalar"
    },
    "connector.isSandbox": {
      "kind": "scalar"
    },
    "connector.updatedAt": {
      "kind": "scalar"
    },
    "status": {
      "kind": "scalar"
    },
    "executionStatus": {
      "kind": "scalar"
    },
    "createdAt": {
      "kind": "scalar"
    },
    "updatedAt": {
      "kind": "scalar"
    },
    "lastUpdatedAt": {
      "kind": "scalar"
    },
    "statusDetail.accounts.lastUpdatedAt": {
      "kind": "scalar"
    },
    "statusDetail.accounts.isUpdated": {
      "kind": "scalar"
    },
    "statusDetail.accounts.warnings": {
      "kind": "array",
      "fields": {
        "code": {
          "kind": "scalar"
        },
        "message": {
          "kind": "scalar"
        },
        "providerMessage": {
          "kind": "scalar"
        }
      }
    },
    "statusDetail.creditCards.lastUpdatedAt": {
      "kind": "scalar"
    },
    "statusDetail.creditCards.isUpdated": {
      "kind": "scalar"
    },
    "statusDetail.creditCards.warnings": {
      "kind": "array",
      "fields": {
        "code": {
          "kind": "scalar"
        },
        "message": {
          "kind": "scalar"
        },
        "providerMessage": {
          "kind": "scalar"
        }
      }
    },
    "statusDetail.investments.lastUpdatedAt": {
      "kind": "scalar"
    },
    "statusDetail.investments.isUpdated": {
      "kind": "scalar"
    },
    "statusDetail.investments.warnings": {
      "kind": "array",
      "fields": {
        "code": {
          "kind": "scalar"
        },
        "message": {
          "kind": "scalar"
        },
        "providerMessage": {
          "kind": "scalar"
        }
      }
    },
    "statusDetail.identity.lastUpdatedAt": {
      "kind": "scalar"
    },
    "statusDetail.identity.isUpdated": {
      "kind": "scalar"
    },
    "statusDetail.identity.warnings": {
      "kind": "array",
      "fields": {
        "code": {
          "kind": "scalar"
        },
        "message": {
          "kind": "scalar"
        },
        "providerMessage": {
          "kind": "scalar"
        }
      }
    },
    "statusDetail.investmentsTransactions.lastUpdatedAt": {
      "kind": "scalar"
    },
    "statusDetail.investmentsTransactions.isUpdated": {
      "kind": "scalar"
    },
    "statusDetail.investmentsTransactions.warnings": {
      "kind": "array",
      "fields": {
        "code": {
          "kind": "scalar"
        },
        "message": {
          "kind": "scalar"
        },
        "providerMessage": {
          "kind": "scalar"
        }
      }
    },
    "statusDetail.paymentData.lastUpdatedAt": {
      "kind": "scalar"
    },
    "statusDetail.paymentData.isUpdated": {
      "kind": "scalar"
    },
    "statusDetail.paymentData.warnings": {
      "kind": "array",
      "fields": {
        "code": {
          "kind": "scalar"
        },
        "message": {
          "kind": "scalar"
        },
        "providerMessage": {
          "kind": "scalar"
        }
      }
    },
    "statusDetail.loans.lastUpdatedAt": {
      "kind": "scalar"
    },
    "statusDetail.loans.isUpdated": {
      "kind": "scalar"
    },
    "statusDetail.loans.warnings": {
      "kind": "array",
      "fields": {
        "code": {
          "kind": "scalar"
        },
        "message": {
          "kind": "scalar"
        },
        "providerMessage": {
          "kind": "scalar"
        }
      }
    },
    "statusDetail.accountStatements.lastUpdatedAt": {
      "kind": "scalar"
    },
    "statusDetail.accountStatements.isUpdated": {
      "kind": "scalar"
    },
    "statusDetail.accountStatements.warnings": {
      "kind": "array",
      "fields": {
        "code": {
          "kind": "scalar"
        },
        "message": {
          "kind": "scalar"
        },
        "providerMessage": {
          "kind": "scalar"
        }
      }
    },
    "nextAutoSyncAt": {
      "kind": "scalar"
    },
    "consentExpiresAt": {
      "kind": "scalar"
    },
    "resourcesCollectedAt": {
      "kind": "scalar"
    },
    "hasResourcesPendingAuthorization": {
      "kind": "scalar"
    },
    "products": {
      "kind": "array_scalar"
    }
  },
  "resources": {
    "resourceId": {
      "kind": "scalar"
    },
    "type": {
      "kind": "scalar"
    },
    "status": {
      "kind": "scalar"
    },
    "id": {
      "kind": "scalar"
    }
  },
  "consents": {
    "id": {
      "kind": "scalar"
    },
    "itemId": {
      "kind": "scalar"
    },
    "products": {
      "kind": "array_scalar"
    },
    "openFinancePermissionsGranted": {
      "kind": "array_scalar"
    },
    "createdAt": {
      "kind": "scalar"
    },
    "expiresAt": {
      "kind": "scalar"
    },
    "revokedAt": {
      "kind": "scalar"
    }
  },
  "connectors": {
    "id": {
      "kind": "decimal"
    },
    "name": {
      "kind": "scalar"
    },
    "type": {
      "kind": "scalar"
    },
    "country": {
      "kind": "scalar"
    },
    "products": {
      "kind": "array_scalar"
    },
    "health.status": {
      "kind": "scalar"
    },
    "health.stage": {
      "kind": "scalar"
    },
    "health.incidents": {
      "kind": "array",
      "fields": {
        "id": {
          "kind": "scalar"
        },
        "title": {
          "kind": "scalar"
        },
        "type": {
          "kind": "scalar"
        },
        "product": {
          "kind": "scalar"
        },
        "kind": {
          "kind": "scalar"
        },
        "severity": {
          "kind": "scalar"
        },
        "state": {
          "kind": "scalar"
        },
        "startedAt": {
          "kind": "scalar"
        },
        "updatedAt": {
          "kind": "scalar"
        }
      }
    },
    "health.details.connectionRateLast6Hours": {
      "kind": "decimal"
    },
    "health.details.connectionsLast6Hours": {
      "kind": "decimal"
    },
    "isOpenFinance": {
      "kind": "scalar"
    },
    "isSandbox": {
      "kind": "scalar"
    },
    "updatedAt": {
      "kind": "scalar"
    }
  },
  "categories": {
    "id": {
      "kind": "scalar"
    },
    "description": {
      "kind": "scalar"
    },
    "descriptionTranslated": {
      "kind": "scalar"
    },
    "parentId": {
      "kind": "scalar"
    },
    "parentDescription": {
      "kind": "scalar"
    }
  },
  "statements": {
    "id": {
      "kind": "scalar"
    },
    "monthYear": {
      "kind": "scalar"
    }
  }
} as const satisfies Record<Resource, Record<string, ProviderField>>;

export default providerFields;
