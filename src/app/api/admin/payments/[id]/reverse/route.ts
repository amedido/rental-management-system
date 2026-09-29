import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function moneyToCents(value: string): number {
  const [whole, decimal = ""] = value.split(".");
  return (
    Number(whole) * 100 +
    Number(decimal.padEnd(2, "0"))
  );
}

function centsToMoney(value: number): string {
  return (value / 100).toFixed(2);
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAdmin();

  if (response) {
    return response;
  }

  const { id } = await context.params;

  if (!id || id.trim() === "") {
    return Response.json(
      {
        error: "Payment ID is required.",
      },
      { status: 400 },
    );
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

  const reversalReason =
    typeof body === "object" &&
    body !== null &&
    "reason" in body &&
    typeof body.reason === "string"
      ? body.reason.trim()
      : "";

  if (reversalReason.length < 5) {
    return Response.json(
      {
        error:
          "A reversal reason of at least 5 characters is required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findUnique({
        where: {
          id: id.trim(),
        },
        select: {
          id: true,
          tenantId: true,
          unitId: true,
          amount: true,
          category: true,
          status: true,
          rentBillId: true,
          waterBillId: true,
          transactionReference: true,
          receipt: {
            select: {
              receiptNumber: true,
            },
          },
          tenant: {
            select: {
              user: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new Error("PAYMENT_NOT_FOUND");
      }

      if (payment.status !== "CONFIRMED") {
        throw new Error("PAYMENT_NOT_CONFIRMED");
      }

      if (payment.rentBillId && payment.waterBillId) {
        throw new Error("PAYMENT_LINKED_TO_MULTIPLE_BILLS");
      }

      if (!payment.rentBillId && !payment.waterBillId) {
        throw new Error("PAYMENT_HAS_NO_BILL");
      }

      const reversedAt = new Date();

      const reversedPayment =
        await transaction.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            status: "REVERSED",
            reversedAt,
            reversalReason,
          },
          select: {
            id: true,
            amount: true,
            status: true,
            reversedAt: true,
            reversalReason: true,
          },
        });

      let billStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
      let remainingBalance: string;

      if (payment.rentBillId) {
        const bill = await transaction.rentBill.findUnique({
          where: {
            id: payment.rentBillId,
          },
          select: {
            id: true,
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

        if (!bill) {
          throw new Error("RENT_BILL_NOT_FOUND");
        }

        const billCents = moneyToCents(
          bill.amount.toString(),
        );

        const paidCents = bill.payments.reduce(
          (total, item) =>
            total + moneyToCents(item.amount.toString()),
          0,
        );

        if (paidCents === 0) {
          billStatus = "UNPAID";
        } else if (paidCents >= billCents) {
          billStatus = "PAID";
        } else {
          billStatus = "PARTIALLY_PAID";
        }

        remainingBalance = centsToMoney(
          Math.max(0, billCents - paidCents),
        );

        await transaction.rentBill.update({
          where: {
            id: bill.id,
          },
          data: {
            status: billStatus,
            paidAt: billStatus === "PAID" ? reversedAt : null,
          },
        });
      } else {
        const bill = await transaction.waterBill.findUnique({
          where: {
            id: payment.waterBillId!,
          },
          select: {
            id: true,
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

        if (!bill) {
          throw new Error("WATER_BILL_NOT_FOUND");
        }

        const billCents = moneyToCents(
          bill.amount.toString(),
        );

        const paidCents = bill.payments.reduce(
          (total, item) =>
            total + moneyToCents(item.amount.toString()),
          0,
        );

        if (paidCents === 0) {
          billStatus = "UNPAID";
        } else if (paidCents >= billCents) {
          billStatus = "PAID";
        } else {
          billStatus = "PARTIALLY_PAID";
        }

        remainingBalance = centsToMoney(
          Math.max(0, billCents - paidCents),
        );

        await transaction.waterBill.update({
          where: {
            id: bill.id,
          },
          data: {
            status: billStatus,
            paidAt: billStatus === "PAID" ? reversedAt : null,
          },
        });
      }

      await transaction.auditEvent.create({
        data: {
          actorUserId: user!.id,
          action: "PAYMENT_REVERSED",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            tenantId: payment.tenantId,
            tenantName: payment.tenant.user.fullName,
            category: payment.category,
            amount: payment.amount.toString(),
            receiptNumber:
              payment.receipt?.receiptNumber ?? null,
            transactionReference:
              payment.transactionReference,
            reversalReason,
            reversedAt: reversedAt.toISOString(),
            billStatus,
            remainingBalance,
          },
          ipAddress: request.headers.get("x-forwarded-for"),
          userAgent: request.headers.get("user-agent"),
        },
      });

      return {
        payment: reversedPayment,
        billStatus,
        remainingBalance,
      };
    });

    return Response.json({
      message:
        "Payment reversed and bill balance restored successfully.",
      ...result,
    });
  } catch (error) {
    const errorCode =
      error instanceof Error ? error.message : "";

    if (errorCode === "PAYMENT_NOT_FOUND") {
      return Response.json(
        { error: "Payment not found." },
        { status: 404 },
      );
    }

    if (errorCode === "PAYMENT_NOT_CONFIRMED") {
      return Response.json(
        {
          error:
            "Only a confirmed payment can be reversed.",
        },
        { status: 400 },
      );
    }

    if (
      errorCode === "RENT_BILL_NOT_FOUND" ||
      errorCode === "WATER_BILL_NOT_FOUND"
    ) {
      return Response.json(
        {
          error:
            "The bill connected to this payment was not found.",
        },
        { status: 404 },
      );
    }

    if (errorCode === "PAYMENT_HAS_NO_BILL") {
      return Response.json(
        {
          error:
            "This payment is not linked to a rent or water bill.",
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error: "Unable to reverse the payment.",
      },
      { status: 500 },
    );
  }
}
