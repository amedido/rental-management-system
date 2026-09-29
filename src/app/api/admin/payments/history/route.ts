import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  const { response } = await requireAdmin();

  if (response) {
    return response;
  }

  const payments = await prisma.payment.findMany({
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
      confirmedAt: true,
      reversedAt: true,
      reversalReason: true,
      transactionReference: true,
      notes: true,
      createdAt: true,

      tenant: {
        select: {
          id: true,
          user: {
            select: {
              fullName: true,
              email: true,
              phone: true,
            },
          },
        },
      },

      unit: {
        select: {
          unitNumber: true,
        },
      },

      receipt: {
        select: {
          id: true,
          receiptNumber: true,
          issuedAt: true,
        },
      },

      recordedBy: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  return Response.json({
    payments: payments.map((payment) => ({
      id: payment.id,
      category: payment.category,
      method: payment.method,
      amount: payment.amount.toString(),
      paymentDate: payment.paymentDate,
      status: payment.status,
      confirmedAt: payment.confirmedAt,
      reversedAt: payment.reversedAt,
      reversalReason: payment.reversalReason,
      transactionReference: payment.transactionReference,
      notes: payment.notes,
      createdAt: payment.createdAt,

      tenant: {
        id: payment.tenant.id,
        fullName: payment.tenant.user.fullName,
        email: payment.tenant.user.email,
        phone: payment.tenant.user.phone,
      },

      unitNumber: payment.unit.unitNumber,

      receipt: payment.receipt
        ? {
            id: payment.receipt.id,
            receiptNumber: payment.receipt.receiptNumber,
            issuedAt: payment.receipt.issuedAt,
          }
        : null,

      recordedBy: payment.recordedBy
        ? {
            fullName: payment.recordedBy.fullName,
            email: payment.recordedBy.email,
          }
        : null,
    })),
  });
}
