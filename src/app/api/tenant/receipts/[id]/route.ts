import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { user, response } = await requireTenant();

  if (response) {
    return response;
  }

  const { id } = await context.params;

  if (!id || id.trim() === "") {
    return Response.json(
      {
        error: "Receipt ID is required.",
      },
      { status: 400 },
    );
  }

  const receipt = await prisma.receipt.findUnique({
    where: {
      id: id.trim(),
    },
    select: {
      id: true,
      receiptNumber: true,
      issuedAt: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          identificationNumber: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          unit: {
            select: {
              id: true,
              unitNumber: true,
              floor: true,
              type: true,
              property: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                },
              },
            },
          },
        },
      },
      issuedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      payment: {
        select: {
          id: true,
          category: true,
          method: true,
          amount: true,
          paymentDate: true,
          status: true,
          transactionReference: true,
          notes: true,
          rentBill: {
            select: {
              id: true,
              billingMonth: true,
              amount: true,
              dueDate: true,
            },
          },
          waterBill: {
            select: {
              id: true,
              billingMonth: true,
              amount: true,
              previousReading: true,
              currentReading: true,
              consumption: true,
              rate: true,
              dueDate: true,
            },
          },
        },
      },
    },
  });

  if (!receipt) {
    return Response.json(
      {
        error: "Receipt not found.",
      },
      { status: 404 },
    );
  }

  if (receipt.tenant.id !== user!.tenant?.id) {
    return Response.json(
      {
        error: "You are not authorized to view this receipt.",
      },
      { status: 403 },
    );
  }

  const bill = receipt.payment.rentBill
    ? {
        id: receipt.payment.rentBill.id,
        type: "RENT",
        billingMonth: receipt.payment.rentBill.billingMonth,
        amount: receipt.payment.rentBill.amount.toString(),
        dueDate: receipt.payment.rentBill.dueDate,
      }
    : receipt.payment.waterBill
      ? {
          id: receipt.payment.waterBill.id,
          type: "WATER",
          billingMonth: receipt.payment.waterBill.billingMonth,
          amount: receipt.payment.waterBill.amount.toString(),
          dueDate: receipt.payment.waterBill.dueDate,
          previousReading:
            receipt.payment.waterBill.previousReading?.toString() ??
            null,
          currentReading:
            receipt.payment.waterBill.currentReading?.toString() ??
            null,
          consumption:
            receipt.payment.waterBill.consumption?.toString() ??
            null,
          rate:
            receipt.payment.waterBill.rate?.toString() ?? null,
        }
      : null;

  return Response.json({
    receipt: {
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      issuedAt: receipt.issuedAt,
      createdAt: receipt.createdAt,
      tenant: {
        id: receipt.tenant.id,
        fullName: receipt.tenant.user.fullName,
        email: receipt.tenant.user.email,
        phone: receipt.tenant.user.phone,
        identificationNumber:
          receipt.tenant.identificationNumber,
        unit: receipt.tenant.unit
          ? {
              id: receipt.tenant.unit.id,
              unitNumber: receipt.tenant.unit.unitNumber,
              floor: receipt.tenant.unit.floor,
              type: receipt.tenant.unit.type,
              property: receipt.tenant.unit.property
                ? {
                    id: receipt.tenant.unit.property.id,
                    name: receipt.tenant.unit.property.name,
                    address: receipt.tenant.unit.property.address,
                  }
                : null,
            }
          : null,
      },
      payment: {
        id: receipt.payment.id,
        category: receipt.payment.category,
        method: receipt.payment.method,
        amount: receipt.payment.amount.toString(),
        paymentDate: receipt.payment.paymentDate,
        status: receipt.payment.status,
        transactionReference:
          receipt.payment.transactionReference,
        notes: receipt.payment.notes,
      },
      bill,
      issuedBy: {
        fullName: receipt.issuedBy?.fullName ?? "Ahmed Abuche",
        email: receipt.issuedBy?.email ?? null,
      },
    },
  });
}
