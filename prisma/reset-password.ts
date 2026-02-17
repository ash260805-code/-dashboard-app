import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const email = "admin@example.com";
    const password = "Admin123!"; // You can change this
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            status: "APPROVED",
            role: "ADMIN"
        },
        create: {
            email,
            password: hashedPassword,
            name: "Admin User",
            role: "ADMIN",
            status: "APPROVED"
        }
    });

    console.log(`\nSUCCESS: Admin user '${user.email}' is ready.`);
    console.log(`Password: ${password}\n`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
