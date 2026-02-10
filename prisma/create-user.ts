import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash("Ashwini123!", 12);

    const user = await prisma.user.upsert({
        where: { email: "ash8867668742@gmail.com" },
        update: {},
        create: {
            email: "ash8867668742@gmail.com",
            password: hashedPassword,
            name: "Ashwini P",
            role: "USER",
            status: "PENDING",
        },
    });

    console.log("Created user:", user.email, "Status:", user.status);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
