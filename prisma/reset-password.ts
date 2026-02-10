import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    // Hash with 12 rounds, same as in register/route.ts
    const hashedPassword = await bcrypt.hash("Ashwini123!", 12);

    const user = await prisma.user.update({
        where: { email: "ash8867668742@gmail.com" },
        data: {
            password: hashedPassword,
            status: "APPROVED" // Ensure approved status too
        },
    });

    console.log("Updated password for:", user.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
