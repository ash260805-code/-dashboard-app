import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const email = "admin@example.com";
    const password = "Admin123!";

    console.log(`Checking user: ${email}...`);

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.error("❌ User NOT FOUND in database!");
        return;
    }

    console.log("✅ User found.");
    console.log(`Stored Hash: ${user.password.substring(0, 15)}...`);
    console.log(`Role: ${user.role}`);
    console.log(`Status: ${user.status}`);

    const match = await bcrypt.compare(password, user.password);

    if (match) {
        console.log("✅ Password 'Admin123!' MATCHES the stored hash.");
    } else {
        console.error("❌ Password 'Admin123!' DOES NOT MATCH the stored hash.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
