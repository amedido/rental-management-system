import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/session";

function parseDate(
  value: string | null,
  endOfDay = false,
) {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`,
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function decimalToNumber(value: unknown) {
  return Number(value ?? 0);
}

function money(value: number) {
  return value.toFixed(2);
}

function getBillStatus(
  amount: number,
  paidAmount: number,
) {
  if (paidAmount >= amount) {
    return "PAID";
  }

  if (paidAmount > 0) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireTenant();

  if (response) {
    return response;
  }

  if (!user?.tenant) {
    return Response.json(
      {
        error: "Tenant profile was not found.",
      },
      { status: 404 },
    );
  }

  const tenantId = user.tenant.id;
  const searchParams = request.nextUrl.searchParams;

  const startDateValue = searchParams.get("startDate");
  const endDateValue = searchParams.get("endDate");

  const startDate = parseDate(startDateValue);
  const endDate = parseDate(endDateValue, true);

  if (startDateValue && !startDate) {
    return Response.json(
      {
        error: "Start date must use YYYY-MM-DD format.",
      },
      { status: 400 },
    );
  }

  if (endDateValue && !endDate) {
    return Response.json(
      {
        error: "End date must use YYYY-MM-DD format.",
      },
      { status: 400 },
    );
  }

  if (startDate && endDate && startDate > endDate) {
    return Response.json(
      {
        error: "Start date cannot be after end date.",
      },
      { status: 400 },
    );
  }

  const rentDateFilter = {
    tenantId,
    ...(startDate || endDate
      ? {
          billingMonth: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  const waterDateFilter = {
    tenantId,
    ...(startDate || endDate
      ? {
          billingMonth: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  const paymentDateFilter = {
    tenantId,
    status: "CONFIRMED" as const,
    ...(startDate || endDate
      ? {
          paymentDate: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  const [
    rentBills,
    waterBills,
    payments,
    previousRentBills,
    previousWaterBills,
    previousPayments,
  ] = await Promise.all([
    prisma.rentBill.findMany({
      where: rentDateFilter,
      orderBy: {
        billingMonth: "asc",
      },
      select: {
        id: true,
        billingMonth: true,
        amount: true,
        adjustment: true,
        dueDate: true,
        status: true,
        issuedAt: true,
        payments: {
          where: {
            status: "CONFIRMED",
          },
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            method: true,
            transactionReference: true,
            receipt: {
              select: {
                receiptNumber: true,
              },
            },
          },
        },
      },
    }),

    prisma.waterBill.findMany({
      where: waterDateFilter,
      orderBy: {
        billingMonth: "asc",
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
        payments: {
          where: {
            status: "CONFIRMED",
          },
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            method: true,
            transactionReference: true,
            receipt: {
              select: {
                receiptNumber: true,
              },
            },
          },
        },
      },
    }),

    prisma.payment.findMany({
      where: paymentDateFilter,
      orderBy: {
        paymentDate: "asc",
      },
      select: {
        id: true,
        amount: true,
        category: true,
        method: true,
        paymentDate: true,
        transactionReference: true,
        rentBill: {
          select: {
            billingMonth: true,
          },
        },
        waterBill: {
          select: {
            billingMonth: true,
          },
        },
        receipt: {
          select: {
            receiptNumber: true,
          },
        },
      },
    }),

    startDate
      ? prisma.rentBill.findMany({
          where: {
            tenantId,
            billingMonth: {
              lt: startDate,
            },
          },
          select: {
            amount: true,
            payments: {
              where: {
                status: "CONFIRMED",
              },
              select: {
                amount: true,
              },
            },
          },
        })
      : Promise.resolve([]),

    startDate
      ? prisma.waterBill.findMany({
          where: {
            tenantId,
            billingMonth: {
              lt: startDate,
            },
          },
          select: {
            amount: true,
            payments: {
              where: {
                status: "CONFIRMED",
              },
              select: {
                amount: true,
              },
            },
          },
        })
      : Promise.resolve([]),

    startDate
      ? prisma.payment.findMany({
          where: {
            tenantId,
            status: "CONFIRMED",
            paymentDate: {
              lt: startDate,
            },
          },
          select: {
            amount: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const previousBilled = [
    ...previousRentBills,
    ...previousWaterBills,
  ].reduce(
    (total, bill) =>
      total + decimalToNumber(bill.amount),
    0,
  );

  const previousPaidFromBills = [
    ...previousRentBills,
    ...previousWaterBills,
  ].reduce(
    (total, bill) =>
      total +
      bill.payments.reduce(
        (billTotal, payment) =>
          billTotal + decimalToNumber(payment.amount),
        0,
      ),
    0,
  );

  const previousPaidFromPayments =
    previousPayments.reduce(
      (total, payment) =>
        total + decimalToNumber(payment.amount),
      0,
    );

  const openingBalance =
    previousBilled - previousPaidFromBills;

  const billRows = [
    ...rentBills.map((bill) => {
      const amount = decimalToNumber(bill.amount);

      const paidAmount = bill.payments.reduce(
        (total, payment) =>
          total + decimalToNumber(payment.amount),
        0,
      );

      return {
        id: bill.id,
        type: "RENT_BILL" as const,
        date: bill.billingMonth,
        description: "Monthly rent",
        amount: money(amount),
        paidAmount: money(paidAmount),
        balance: money(
          Math.max(amount - paidAmount, 0),
        ),
        status: getBillStatus(amount, paidAmount),
        dueDate: bill.dueDate,
        reference: null,
      };
    }),

    ...waterBills.map((bill) => {
      const amount = decimalToNumber(bill.amount);

      const paidAmount = bill.payments.reduce(
        (total, payment) =>
          total + decimalToNumber(payment.amount),
        0,
      );

      return {
        id: bill.id,
        type: "WATER_BILL" as const,
        date: bill.billingMonth,
        description: "Monthly water bill",
        amount: money(amount),
        paidAmount: money(paidAmount),
        balance: money(
          Math.max(amount - paidAmount, 0),
        ),
        status: getBillStatus(amount, paidAmount),
        dueDate: bill.dueDate,
        reference: null,
      };
    }),
  ];

  const paymentRows = payments.map((payment) => ({
    id: payment.id,
    type: "PAYMENT" as const,
    date: payment.paymentDate,
    description:
      payment.category === "RENT"
        ? "Rent payment"
        : "Water payment",
    amount: money(-decimalToNumber(payment.amount)),
    paidAmount: money(decimalToNumber(payment.amount)),
    balance: money(0),
    status: "CONFIRMED",
    dueDate: null,
    reference:
      payment.receipt?.receiptNumber ??
      payment.transactionReference ??
      null,
    method: payment.method,
  }));

  const rows = [
    ...billRows,
    ...paymentRows,
  ].sort(
    (first, second) =>
      new Date(first.date).getTime() -
      new Date(second.date).getTime(),
  );

  let runningBalance = openingBalance;

  const transactions = rows.map((row) => {
    if (row.type === "PAYMENT") {
      runningBalance += Number(row.amount);
    } else {
      runningBalance += Number(row.amount);
    }

    return {
      ...row,
      runningBalance: money(runningBalance),
      date: new Date(row.date).toISOString(),
      dueDate: row.dueDate
        ? new Date(row.dueDate).toISOString()
        : null,
    };
  });

  const totalBilled = billRows.reduce(
    (total, row) => total + Number(row.amount),
    0,
  );

  const totalPaid = payments.reduce(
    (total, payment) =>
      total + decimalToNumber(payment.amount),
    0,
  );

  const closingBalance =
    openingBalance + totalBilled - totalPaid;

  return Response.json(
    {
      tenant: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        unitNumber: user.tenant.unit?.unitNumber ?? null,
      },
      filters: {
        startDate: startDateValue,
        endDate: endDateValue,
      },
      summary: {
        openingBalance: money(openingBalance),
        totalBilled: money(totalBilled),
        totalPaid: money(totalPaid),
        closingBalance: money(closingBalance),
      },
      transactions,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
