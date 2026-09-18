require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Check the .env file in the project root.",
  );
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const apartments = [
  { unitNumber: "G1", type: "ONE_BEDROOM", floor: 0 },
  { unitNumber: "G2", type: "ONE_BEDROOM", floor: 0 },
  { unitNumber: "G3", type: "ONE_BEDROOM", floor: 0 },

  { unitNumber: "A1", type: "ONE_BEDROOM", floor: 1 },
  { unitNumber: "A2", type: "ONE_BEDROOM", floor: 1 },
  { unitNumber: "A3", type: "ONE_BEDROOM", floor: 1 },
  { unitNumber: "A4", type: "ONE_BEDROOM", floor: 1 },

  { unitNumber: "B1", type: "ONE_BEDROOM", floor: 2 },
  { unitNumber: "B2", type: "ONE_BEDROOM", floor: 2 },
  { unitNumber: "B3", type: "ONE_BEDROOM", floor: 2 },
  { unitNumber: "B4", type: "ONE_BEDROOM", floor: 2 },

  { unitNumber: "C1", type: "ONE_BEDROOM", floor: 3 },
  { unitNumber: "C2", type: "ONE_BEDROOM", floor: 3 },
  { unitNumber: "C3", type: "ONE_BEDROOM", floor: 3 },
  { unitNumber: "C4", type: "ONE_BEDROOM", floor: 3 },

  { unitNumber: "D1", type: "ONE_BEDROOM", floor: 4 },
  { unitNumber: "D2", type: "ONE_BEDROOM", floor: 4 },
  { unitNumber: "D3", type: "ONE_BEDROOM", floor: 4 },
  { unitNumber: "D4", type: "ONE_BEDROOM", floor: 4 },

  { unitNumber: "E1", type: "ONE_BEDROOM", floor: 5 },
  { unitNumber: "E2", type: "ONE_BEDROOM", floor: 5 },
  { unitNumber: "E3", type: "ONE_BEDROOM", floor: 5 },
  { unitNumber: "E4", type: "ONE_BEDROOM", floor: 5 },

  { unitNumber: "F1", type: "ONE_BEDROOM", floor: 6 },
  { unitNumber: "F2", type: "ONE_BEDROOM", floor: 6 },
  { unitNumber: "F3", type: "ONE_BEDROOM", floor: 6 },
  { unitNumber: "F4", type: "ONE_BEDROOM", floor: 6 },
];

const shops = [
  { unitNumber: "S1", type: "SHOP", floor: 0 },
  { unitNumber: "S2", type: "SHOP", floor: 0 },
];

const expectedUnits = [...apartments, ...shops];

async function main() {
  const property = await prisma.property.upsert({
    where: {
      name: "Mashaallah",
    },
    update: {
      address: "Mashaallah Apartment",
      floors: 6,
    },
    create: {
      name: "Mashaallah",
      address: "Mashaallah Apartment",
      floors: 6,
    },
  });

  const expectedUnitNumbers = expectedUnits.map(
    (unit) => unit.unitNumber,
  );

  const obsoleteUnits = await prisma.unit.findMany({
    where: {
      propertyId: property.id,
      unitNumber: {
        notIn: expectedUnitNumbers,
      },
    },
    select: {
      id: true,
      unitNumber: true,
      tenant: {
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          rentBills: true,
          waterBills: true,
          payments: true,
        },
      },
    },
  });

  for (const unit of obsoleteUnits) {
    const hasHistory =
      unit.tenant !== null ||
      unit._count.rentBills > 0 ||
      unit._count.waterBills > 0 ||
      unit._count.payments > 0;

    if (hasHistory) {
      throw new Error(
        `Cannot remove obsolete unit ${unit.unitNumber} because it has tenant or financial history.`,
      );
    }

    await prisma.unit.delete({
      where: {
        id: unit.id,
      },
    });
  }

  for (const unit of expectedUnits) {
    await prisma.unit.upsert({
      where: {
        propertyId_unitNumber: {
          propertyId: property.id,
          unitNumber: unit.unitNumber,
        },
      },
      update: {
        type: unit.type,
        floor: unit.floor,
      },
      create: {
        propertyId: property.id,
        unitNumber: unit.unitNumber,
        type: unit.type,
        floor: unit.floor,
        monthlyRent: 0,
      },
    });
  }

  const apartmentCount = await prisma.unit.count({
    where: {
      propertyId: property.id,
      type: "ONE_BEDROOM",
    },
  });

  const shopCount = await prisma.unit.count({
    where: {
      propertyId: property.id,
      type: "SHOP",
    },
  });

  const totalCount = await prisma.unit.count({
    where: {
      propertyId: property.id,
    },
  });

  console.log(`Seeded ${property.name}.`);
  console.log(`One-bedroom apartments: ${apartmentCount}`);
  console.log(`Shops: ${shopCount}`);
  console.log(`Total units: ${totalCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
