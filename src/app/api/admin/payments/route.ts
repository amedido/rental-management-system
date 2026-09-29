import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

function parsePaymentDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function moneyToCents(value: string): number {
  const [whole, decimal = ""] = value.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}

function centsToMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

function makeReceiptNumber() {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `MAS-${datePart}-${randomPart}`;
}

export async function GET() {
  const { response } = await requireAdmin();

  if (response) {
    return response;
  }

  const tenants = await prisma.tenant.findMany({
    where: {
      user: {
        role: "TENANT",
        accountStatus: "ACTIVE",
      },
      unitId: {
        not: null,
      },
    },
    orderBy: {
      user: {
        fullName: "asc",
      },
    },
    select: {
      id: true,
      user: {
        select: {
          fullName: true,
          email: true,
        },
      },
      unit: {
        select: {
          id: true,
          unitNumber: true,
        },
      },
      rentBills: {
        where: {
          status: {
            in: ["UNPAID", "PARTIALLY_PAID"],
          },
        },
        orderBy: {
          billingMonth: "desc",
        },
        select: {
          id: true,
          billingMonth: true,
          amount: true,
          status: true,
          payments: {
            where: {
              status: "CONFIRMED",
              reversedAt: null,
            },
            select: {
              amount: true,
            },
          },
        },
      },
      waterBills: {
        where: {
          status: {
            in: ["UNPAID", "PARTIALLY_PAID"],
          },
        },
        orderBy: {
          billingMonth: "desc",
        },
        select: {
          id: true,
          billingMonth: true,
          amount: true,
          status: true,
          payments: {
            where: {
              status: "CONFIRMED",
              reversedAt: null,
            },
            select: {
              amount: true,
            },
          },
        },
      },
    },
  });

  return Response.json({
    tenants: tenants.map((tenant) => ({
      id: tenant.id,
      fullName: tenant.user.fullName,
      email: tenant.user.email,
      unitNumber: tenant.unit?.unitNumber ?? null,
      rentBills: tenant.rentBills.map((bill) => {
        const amount = Number(bill.amount);
        const paid = bill.payments.reduce(
          (total, payment) => total + Number(payment.amount),
          0,
        );

        return {
          id: bill.id,
          billingMonth: bill.billingMonth,
          amount: amount.toFixed(2),
          paidAmount: paid.toFixed(2),
          balance: Math.max(0, amount - paid).toFixed(2),
          status: bill.status,
        };
      }),
      waterBills: tenant.waterBills.map((bill) => {
        const amount = Number(bill.amount);
        const paid = bill.payments.reduce(
          (total, payment) => total + Number(payment.amount),
          0,
        );

        return {
          id: bill.id,
          billingMonth: bill.billingMonth,
          amount: amount.toFixed(2),
          paidAmount: paid.toFixed(2),
          balance: Math.max(0, amount - paid).toFixed(2),
          status: bill.status,
        };
      }),
    })),
  });
}


export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin();

  if (response) {
    return response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return Response.json(
      {
        error: "Request body is required.",
      },
      { status: 400 },
    );
  }

  const input = body as {
    tenantId?: unknown;
    rentBillId?: unknown;
    waterBillId?: unknown;
    amount?: unknown;
    paymentDate?: unknown;
    transactionReference?: unknown;
    notes?: unknown;
  };

  const tenantId =
    typeof input.tenantId === "string"
      ? input.tenantId.trim()
      : "";

  const rentBillId =
    typeof input.rentBillId === "string"
      ? input.rentBillId.trim()
      : "";

  const waterBillId =
    typeof input.waterBillId === "string"
      ? input.waterBillId.trim()
      : "";

  const amountText = String(input.amount ?? "").trim();

  if (!tenantId) {
    return Response.json(
      { error: "tenantId is required." },
      { status: 400 },
    );
  }

  if ((rentBillId && waterBillId) || (!rentBillId && !waterBillId)) {
    return Response.json(
      {
        error:
          "Provide exactly one rentBillId or waterBillId.",
      },
      { status: 400 },
    );
  }

  if (!MONEY_PATTERN.test(amountText)) {
    return Response.json(
      {
        error:
          "Payment amount must be a valid amount with no more than 2 decimal places.",
      },
      { status: 400 },
    );
  }

  const paymentCents = moneyToCents(amountText);

  if (paymentCents <= 0) {
    return Response.json(
      {
        error: "Payment amount must be greater than zero.",
      },
      { status: 400 },
    );
  }

  const paymentDate = parsePaymentDate(input.paymentDate);

  if (!paymentDate) {
    return Response.json(
      {
        error: "A valid payment date is required.",
      },
      { status: 400 },
    );
  }

  const transactionReference =
    typeof input.transactionReference === "string"
      ? input.transactionReference.trim() || null
      : null;

  const notes =
    typeof input.notes === "string"
      ? input.notes.trim() || null
      : null;

  const category = rentBillId ? "RENT" : "WATER";
  const method = rentBillId ? "BANK" : "MPESA";

  const result = await prisma.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.findUnique({
      where: {
        id: tenantId,
      },
      select: {
        id: true,
        user: {
          select: {
            fullName: true,
            email: true,
            role: true,
            accountStatus: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
          },
        },
      },
    });

    if (!tenant || tenant.user.role !== "TENANT") {
      throw new Error("TENANT_NOT_FOUND");
    }

    if (tenant.user.accountStatus !== "ACTIVE") {
      throw new Error("TENANT_NOT_ACTIVE");
    }

    if (!tenant.unit) {
      throw new Error("TENANT_UNIT_NOT_ASSIGNED");
    }

    let bill:
      | {
          id: string;
          tenantId: string;
          unitId: string;
          amount: { toString(): string };
          payments: Array<{ amount: { toString(): string } }>;
        }
      | null = null;

    if (rentBillId) {
      bill = await transaction.rentBill.findUnique({
        where: {
          id: rentBillId,
        },
        select: {
          id: true,
          tenantId: true,
          unitId: true,
          amount: true,
          payments: {
            where: {
              status: "CONFIRMED",
              reversedAt: null,
            },
            select: {
              amount: true,
            },
          },
        },
      });
    } else {
      bill = await transaction.waterBill.findUnique({
        where: {
          id: waterBillId,
        },
        select: {
          id: true,
          tenantId: true,
          unitId: true,
          amount: true,
          payments: {
            where: {
              status: "CONFIRMED",
              reversedAt: null,
            },
            select: {
              amount: true,
            },
          },
        },
      });
    }

    if (!bill) {
      throw new Error("BILL_NOT_FOUND");
    }

    if (bill.tenantId !== tenant.id) {
      throw new Error("BILL_TENANT_MISMATCH");
    }

    if (bill.unitId !== tenant.unit.id) {
      throw new Error("BILL_UNIT_MISMATCH");
    }

    const billCents = moneyToCents(bill.amount.toString());

    const alreadyPaidCents = bill.payments.reduce(
      (total, payment) =>
        total + moneyToCents(payment.amount.toString()),
      0,
    );

    const outstandingCents = Math.max(
      0,
      billCents - alreadyPaidCents,
    );

    if (paymentCents > outstandingCents) {
      throw new Error(
        `PAYMENT_TOO_LARGE:${centsToMoney(outstandingCents)}`,
      );
    }

    if (transactionReference) {
      const existingPayment =
        await transaction.payment.findUnique({
          where: {
            transactionReference,
          },
          select: {
            id: true,
          },
        });

      if (existingPayment) {
        throw new Error("DUPLICATE_TRANSACTION_REFERENCE");
      }
    }

    const newPaidCents = alreadyPaidCents + paymentCents;
    const fullyPaid = newPaidCents >= billCents;
    const now = new Date();

    const payment = await transaction.payment.create({
      data: {
        tenantId: tenant.id,
        unitId: tenant.unit.id,
        rentBillId: rentBillId || null,
        waterBillId: waterBillId || null,
        recordedById: user!.id,
        category,
        amount: amountText,
        method,
        transactionReference,
        paymentDate,
        status: "CONFIRMED",
        confirmedAt: now,
        notes,
      },
      select: {
        id: true,
        amount: true,
        category: true,
        method: true,
        status: true,
        paymentDate: true,
      },
    });

    if (rentBillId) {
      await transaction.rentBill.update({
        where: {
          id: rentBillId,
        },
        data: {
          status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
          paidAt: fullyPaid ? now : null,
        },
      });
    } else {
      await transaction.waterBill.update({
        where: {
          id: waterBillId,
        },
        data: {
          status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
          paidAt: fullyPaid ? now : null,
        },
      });
    }

    const receipt = await transaction.receipt.create({
      data: {
        receiptNumber: makeReceiptNumber(),
        paymentId: payment.id,
        tenantId: tenant.id,
        issuedById: user!.id,
      },
      select: {
        id: true,
        receiptNumber: true,
        issuedAt: true,
      },
    });

    await transaction.auditEvent.create({
      data: {
        actorUserId: user!.id,
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.user.fullName,
          unitNumber: tenant.unit.unitNumber,
          billId: bill.id,
          category,
          method,
          amount: amountText,
          paymentDate: paymentDate.toISOString(),
          receiptNumber: receipt.receiptNumber,
          recordedAt: now.toISOString(),
        },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return {
      payment,
      receipt,
      billStatus: fullyPaid ? "PAID" : "PARTIALLY_PAID",
      remainingBalance: centsToMoney(
        Math.max(0, billCents - newPaidCents),
      ),
    };
  });

  return Response.json(
    {
      message: "Payment recorded and receipt generated successfully.",
      ...result,
      payment: {
        ...result.payment,
        amount: result.payment.amount.toString(),
      },
    },
    { status: 201 },
  );
}
