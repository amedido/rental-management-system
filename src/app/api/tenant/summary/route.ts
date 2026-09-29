import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/session";

type PaymentForBalance = {
  amount: unknown;
};

function decimalToNumber(value: unknown): number {
  return Number(value ?? 0);
}

function calculatePaidAmount(
  payments: PaymentForBalance[],
): number {
  return payments.reduce(
    (total, payment) => total + decimalToNumber(payment.amount),
    0,
  );
}

function calculateBillSummary(
  amount: unknown,
  payments: PaymentForBalance[],
) {
  const billAmount = decimalToNumber(amount);
  const paidAmount = calculatePaidAmount(payments);
  const balance = Math.max(0, billAmount - paidAmount);

  let status = "UNPAID";

  if (balance <= 0) {
    status = "PAID";
  } else if (paidAmount > 0) {
    status = "PARTIALLY_PAID";
  }

  return {
    amount: billAmount.toFixed(2),
    paidAmount: paidAmount.toFixed(2),
    balance: balance.toFixed(2),
    status,
  };
}

function serializePayment(payment: {
  id: string;
  amount: unknown;
  paymentDate: Date;
  method: unknown;
  category: unknown;
  transactionReference: string | null;
}) {
  return {
    id: payment.id,
    amount: decimalToNumber(payment.amount).toFixed(2),
    paymentDate: payment.paymentDate,
    method: payment.method,
    category: payment.category,
    transactionReference: payment.transactionReference,
  };
}

export async function GET() {
  const { user, response } = await requireTenant();

  if (response) {
    return response;
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      userId: user!.id,
    },
    select: {
      id: true,
      monthlyRent: true,
      requestedUnitNumber: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          accountStatus: true,
        },
      },
      unit: {
        select: {
          id: true,
          unitNumber: true,
          floor: true,
          type: true,
          status: true,
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              waterRate: true,
            },
          },
        },
      },
      rentBills: {
        orderBy: {
          billingMonth: "desc",
        },
        select: {
          id: true,
          billingMonth: true,
          amount: true,
          adjustment: true,
          dueDate: true,
          status: true,
          issuedAt: true,
          paidAt: true,
          notes: true,
          payments: {
            where: {
              status: "CONFIRMED",
              reversedAt: null,
            },
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              method: true,
              category: true,
              transactionReference: true,
            },
          },
        },
      },
      waterBills: {
        orderBy: {
          billingMonth: "desc",
        },
        select: {
          id: true,
          billingMonth: true,
          previousReading: true,
          currentReading: true,
          consumption: true,
          rate: true,
          amount: true,
          dueDate: true,
          status: true,
          issuedAt: true,
          paidAt: true,
          notes: true,
          payments: {
            where: {
              status: "CONFIRMED",
              reversedAt: null,
            },
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              method: true,
              category: true,
              transactionReference: true,
            },
          },
        },
      },
      payments: {
        where: {
          status: "CONFIRMED",
          reversedAt: null,
        },
        orderBy: {
          paymentDate: "desc",
        },
          select: {
            id: true,
            category: true,
            method: true,
            amount: true,
            paymentDate: true,
            status: true,
            transactionReference: true,
            rentBillId: true,
            waterBillId: true,
            receipt: {
              select: {
                id: true,
                receiptNumber: true,
                issuedAt: true,
            },
          },
        },
      },
    },
  });

  if (!tenant) {
    return Response.json(
      {
        error: "Tenant profile was not found.",
      },
      { status: 404 },
    );
  }

  const rentBills = tenant.rentBills.map((bill) => {
    const summary = calculateBillSummary(
      bill.amount,
      bill.payments,
    );

    return {
      id: bill.id,
      billingMonth: bill.billingMonth,
      ...summary,
      adjustment: decimalToNumber(bill.adjustment).toFixed(2),
      dueDate: bill.dueDate,
      originalStatus: bill.status,
      issuedAt: bill.issuedAt,
      paidAt: bill.paidAt,
      notes: bill.notes,
      payments: bill.payments.map(serializePayment),
    };
  });

  const waterBills = tenant.waterBills.map((bill) => {
    const summary = calculateBillSummary(
      bill.amount,
      bill.payments,
    );

    return {
      id: bill.id,
      billingMonth: bill.billingMonth,
      ...summary,
      previousReading:
        bill.previousReading?.toString() ?? null,
      currentReading:
        bill.currentReading?.toString() ?? null,
      consumption: bill.consumption?.toString() ?? null,
      rate: bill.rate?.toString() ?? null,
      dueDate: bill.dueDate,
      originalStatus: bill.status,
      issuedAt: bill.issuedAt,
      paidAt: bill.paidAt,
      notes: bill.notes,
      payments: bill.payments.map(serializePayment),
    };
  });

  const rentBalance = rentBills.reduce(
    (total, bill) => total + Number(bill.balance),
    0,
  );

  const waterBalance = waterBills.reduce(
    (total, bill) => total + Number(bill.balance),
    0,
  );

  const payments = tenant.payments.map((payment) => ({
  id: payment.id,
  category: payment.category,
  method: payment.method,
  amount: payment.amount.toString(),
  paymentDate: payment.paymentDate,
  status: payment.status,
  transactionReference: payment.transactionReference,
  rentBillId: payment.rentBillId,
  waterBillId: payment.waterBillId,
  receipt: payment.receipt
    ? {
        id: payment.receipt.id,
        receiptNumber: payment.receipt.receiptNumber,
        issuedAt: payment.receipt.issuedAt,
      }
    : null,
}));


  return Response.json({
    tenant: {
      id: tenant.id,
      fullName: tenant.user.fullName,
      email: tenant.user.email,
      phone: tenant.user.phone,
      accountStatus: tenant.user.accountStatus,
      monthlyRent: tenant.monthlyRent.toString(),
      requestedUnitNumber: tenant.requestedUnitNumber,
    },
    unit: tenant.unit
      ? {
          id: tenant.unit.id,
          unitNumber: tenant.unit.unitNumber,
          floor: tenant.unit.floor,
          type: tenant.unit.type,
          status: tenant.unit.status,
          property: tenant.unit.property
            ? {
                id: tenant.unit.property.id,
                name: tenant.unit.property.name,
                address: tenant.unit.property.address,
                waterRate:
                  tenant.unit.property.waterRate.toString(),
              }
            : null,
        }
      : null,
    balances: {
      rent: rentBalance.toFixed(2),
      water: waterBalance.toFixed(2),
      total: (rentBalance + waterBalance).toFixed(2),
    },
    rentBills,
    waterBills,
    payments,
  });
}
