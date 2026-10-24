ALTER TABLE transactions ADD COLUMN identification TEXT CHECK(identification IS NULL OR json_valid(identification));

-- Existing card/operation metadata remains available before the next import.
UPDATE transactions
SET identification=json_object(
  'operationType',json_extract(detail.data,'$.operationType'),
  'creditCardMetadata',json_object(
    'billId',json_extract(detail.data,'$.billId'),
    'cardNumber',json_extract(detail.data,'$.cardNumber'),
    'installmentNumber',json_extract(detail.data,'$.installmentNumber'),
    'purchaseDate',json_extract(detail.data,'$.purchaseDate'),
    'totalInstallments',json_extract(detail.data,'$.totalInstallments')
  )
)
FROM planning_transactionDetails detail
WHERE transactions.id=detail.id;
