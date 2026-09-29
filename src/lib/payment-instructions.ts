export const PAYMENT_INSTRUCTIONS = {
  rent: {
    method: "BANK",
    bank: "Equity Bank",
    businessNumber: "247247",
    accountPrefix: "972944",
    instructions:
      "For rent, transfer through Equity Bank using Business Number 247247 and account reference 972944# followed by the tenant's unit number.",
  },
  water: {
    method: "MPESA",
    phoneNumber: "0797568316",
    instructions:
      "For water, send payment through M-Pesa to 0797568316.",
  },
} as const;
