import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    // Create admin user
    const hashedPassword = await bcrypt.hash("Admin123!", 12);

    const admin = await prisma.user.upsert({
        where: { email: "admin@example.com" },
        update: {},
        create: {
            email: "admin@example.com",
            password: hashedPassword,
            name: "Admin User",
            role: "ADMIN",
            status: "APPROVED",
        },
    });

    console.log("Created admin user:", admin.email);

    // Create sample transactions for admin
    await prisma.financialTransaction.createMany({
        data: [
            {
                amount: 1500.00,
                status: "COMPLETED",
                userId: admin.id,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // 1 day ago
            },
            {
                amount: 2300.50,
                status: "COMPLETED",
                userId: admin.id,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
            },
            {
                amount: 450.00,
                status: "PENDING",
                userId: admin.id,
                createdAt: new Date(),
            },
            {
                amount: 3998.50,
                status: "COMPLETED",
                userId: admin.id,
                createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
            },
        ],
    });

    console.log("Created sample transactions for admin");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });