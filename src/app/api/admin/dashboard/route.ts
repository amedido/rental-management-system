import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

function moneyToNumber(value: { toString(): string }) {
  return Number(value.toString());
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function monthKey(value: Date) {
  return value.toISOString().slice(0, 7);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");

  return new Date(
    Number(year),
    Number(month) - 1,
    1,
  ).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
  });
}

export async function GET() {
  const { response } = await requireAdmin();

  if (response) {
    return response;
  }

  const [
    rentBills,
    waterBills,
    confirmedPayments,
    reversedPayments,
    activeTenants,
    occupiedUnits,
    totalUnits,
    tenantBalanceRecords,
  ] = await Promise.all([
    prisma.rentBill.findMany({
      select: {
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
    }),

    prisma.waterBill.findMany({
      select: {
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
    }),

    prisma.payment.findMany({
      where: {
        status: "CONFIRMED",
        reversedAt: null,
      },
      select: {
        amount: true,
        category: true,
        paymentDate: true,
      },
      orderBy: {
        paymentDate: "asc",
      },
    }),

    prisma.payment.findMany({
      where: {
        status: "REVERSED",
      },
      select: {
        amount: true,
        category: true,
      },
    }),

    prisma.tenant.count({
      where: {
        user: {
          role: "TENANT",
          accountStatus: "ACTIVE",
        },
      },
    }),

    prisma.unit.count({
      where: {
        status: "OCCUPIED",
      },
    }),

    prisma.unit.count(),

    prisma.tenant.findMany({
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
            unitNumber: true,
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
          orderBy: {
            billingMonth: "desc",
          },
          select: {
            id: true,
            billingMonth: true,
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
        },
      },
    }),
  ]);

  const rentCollected = confirmedPayments
    .filter((payment) => payment.category === "RENT")
    .reduce(
      (total, payment) =>
        total + moneyToNumber(payment.amount),
      0,
    );

  const waterCollected = confirmedPayments
    .filter((payment) => payment.category === "WATER")
    .reduce(
      (total, payment) =>
        total + moneyToNumber(payment.amount),
      0,
    );

  const reversedTotal = reversedPayments.reduce(
    (total, payment) =>
      total + moneyToNumber(payment.amount),
    0,
  );

  let outstandingRent = 0;
  let outstandingWater = 0;

  let paidRentBills = 0;
  let partialRentBills = 0;
  let unpaidRentBills = 0;

  let paidWaterBills = 0;
  let partialWaterBills = 0;
  let unpaidWaterBills = 0;

  for (const bill of rentBills) {
    const amount = moneyToNumber(bill.amount);

    const paid = bill.payments.reduce(
      (total, payment) =>
        total + moneyToNumber(payment.amount),
      0,
    );

    const balance = Math.max(0, amount - paid);

    outstandingRent += balance;

    if (balance === 0) {
      paidRentBills += 1;
    } else if (paid > 0) {
      partialRentBills += 1;
    } else {
      unpaidRentBills += 1;
    }
  }

  for (const bill of waterBills) {
    const amount = moneyToNumber(bill.amount);

    const paid = bill.payments.reduce(
      (total, payment) =>
        total + moneyToNumber(payment.amount),
      0,
    );

    const balance = Math.max(0, amount - paid);

    outstandingWater += balance;

    if (balance === 0) {
      paidWaterBills += 1;
    } else if (paid > 0) {
      partialWaterBills += 1;
    } else {
      unpaidWaterBills += 1;
    }
  }

  const tenantBalances = tenantBalanceRecords
    .map((tenant) => {
      const rentBills = tenant.rentBills
        .map((bill) => {
          const amount = moneyToNumber(bill.amount);

          const paid = bill.payments.reduce(
            (total, payment) =>
              total + moneyToNumber(payment.amount),
            0,
          );

          const balance = Math.max(0, amount - paid);

          return {
            id: bill.id,
            billingMonth: bill.billingMonth,
            amount: toMoney(amount),
            paidAmount: toMoney(paid),
            balance: toMoney(balance),
          };
        })
        .filter((bill) => Number(bill.balance) > 0);

      const waterBills = tenant.waterBills
        .map((bill) => {
          const amount = moneyToNumber(bill.amount);

          const paid = bill.payments.reduce(
            (total, payment) =>
              total + moneyToNumber(payment.amount),
            0,
          );

          const balance = Math.max(0, amount - paid);

          return {
            id: bill.id,
            billingMonth: bill.billingMonth,
            amount: toMoney(amount),
            paidAmount: toMoney(paid),
            balance: toMoney(balance),
          };
        })
        .filter((bill) => Number(bill.balance) > 0);

      const rentBalance = rentBills.reduce(
        (total, bill) =>
          total + Number(bill.balance),
        0,
      );

      const waterBalance = waterBills.reduce(
        (total, bill) =>
          total + Number(bill.balance),
        0,
      );

      return {
        id: tenant.id,
        fullName: tenant.user.fullName,
        email: tenant.user.email,
        unitNumber: tenant.unit?.unitNumber ?? "Unassigned",
        rentBalance: toMoney(rentBalance),
        waterBalance: toMoney(waterBalance),
        totalBalance: toMoney(
          rentBalance + waterBalance,
        ),
        rentBills,
        waterBills,
      };
    })
    .filter(
      (tenant) => Number(tenant.totalBalance) > 0,
    )
    .sort(
      (first, second) =>
        Number(second.totalBalance) -
        Number(first.totalBalance),
    );

  const monthlyMap = new Map<
    string,
    {
      rent: number;
      water: number;
      total: number;
    }
  >();

  for (const payment of confirmedPayments) {
    const key = monthKey(payment.paymentDate);

    const current = monthlyMap.get(key) ?? {
      rent: 0,
      water: 0,
      total: 0,
    };

    const amount = moneyToNumber(payment.amount);

    if (payment.category === "RENT") {
      current.rent += amount;
    }

    if (payment.category === "WATER") {
      current.water += amount;
    }

    current.total += amount;
    monthlyMap.set(key, current);
  }

  const monthlyCollections = Array.from(
    monthlyMap.entries(),
  )
    .sort(([first], [second]) =>
      first.localeCompare(second),
    )
    .slice(-6)
    .map(([month, values]) => ({
      month,
      label: monthLabel(month),
      rent: toMoney(values.rent),
      water: toMoney(values.water),
      total: toMoney(values.total),
    }));

  return Response.json({
    generatedAt: new Date().toISOString(),

    occupancy: {
      activeTenants,
      occupiedUnits,
      totalUnits,
      vacantUnits: Math.max(
        0,
        totalUnits - occupiedUnits,
      ),
    },

    collections: {
      rent: toMoney(rentCollected),
      water: toMoney(waterCollected),
      total: toMoney(
        rentCollected + waterCollected,
      ),
      reversed: toMoney(reversedTotal),
    },

    outstanding: {
      rent: toMoney(outstandingRent),
      water: toMoney(outstandingWater),
      total: toMoney(
        outstandingRent + outstandingWater,
      ),
    },

    bills: {
      rent: {
        paid: paidRentBills,
        partiallyPaid: partialRentBills,
        unpaid: unpaidRentBills,
        total: rentBills.length,
      },
      water: {
        paid: paidWaterBills,
        partiallyPaid: partialWaterBills,
        unpaid: unpaidWaterBills,
        total: waterBills.length,
      },
    },

    monthlyCollections,
    tenantBalances,
  });
}
