import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Approve the user account
    const user = await prisma.user.update({
        where: { email: "ash8867668742@gmail.com" },
        data: { status: "APPROVED" },
    });

    console.log("Approved user:", user.email, "Status:", user.status);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
