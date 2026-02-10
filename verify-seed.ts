
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const userCount = await prisma.user.count();
    const transactionCount = await prisma.financialTransaction.count();
    console.log(`Users: ${userCount}`);
    console.log(`Transactions: ${transactionCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
