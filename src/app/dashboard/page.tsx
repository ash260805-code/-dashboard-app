import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

async function getStats(userId: string) {
    const [transactionCount, transactions, allTransactions] = await Promise.all([
        prisma.financialTransaction.count({
            where: { userId },
        }),
        prisma.financialTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 5,
        }),
        prisma.financialTransaction.findMany({
            where: { userId, status: "COMPLETED" },
        }),
    ]);

    const totalRevenue = allTransactions.reduce((acc, curr) => acc + curr.amount, 0);

    return {
        transactionCount,
        recentTransactions: transactions,
        revenue: totalRevenue,
    };
}

export default async function DashboardPage() {
    const session = await auth();

    if (!session) {
        redirect("/login");
    }

    if (session.user.status !== "APPROVED") {
        redirect("/pending");
    }

    const stats = await getStats(session.user.id);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Navigation */}
            <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-purple-600 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-white">Dashboard</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-gray-300">{session.user.email}</span>
                            <form action={async () => {
                                "use server";
                                await signOut({ redirectTo: "/login" });
                            }}>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                                >
                                    Sign Out
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Banner */}
                <div className="bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-500/30 rounded-2xl p-6 mb-8">
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Welcome, {session.user.name || "User"}! 👋
                    </h1>
                    <p className="text-gray-300">
                        Your account has been approved. You now have full access to the dashboard.
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Total Transactions</p>
                                <p className="text-2xl font-bold text-white">{stats.transactionCount}</p>
                            </div>
                        </div>
                    </div>

                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-green-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Total Revenue</p>
                                <p className="text-2xl font-bold text-white">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.revenue)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-500 to-purple-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Account Status</p>
                                <p className="text-2xl font-bold text-white">{session.user.status}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Recent Transactions</h2>
                    <div className="space-y-4">
                        {stats.recentTransactions.map((transaction) => (
                            <div key={transaction.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${transaction.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-300" :
                                    transaction.status === "PENDING" ? "bg-amber-500/20 text-amber-300" :
                                        "bg-red-500/20 text-red-300"
                                    }`}>
                                    {transaction.status === "COMPLETED" ? "✓" : transaction.status === "PENDING" ? "⏳" : "✕"}
                                </div>
                                <div className="flex-1">
                                    <p className="text-white font-medium">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(transaction.amount)}
                                    </p>
                                    <p className="text-gray-400 text-sm">
                                        {new Date(transaction.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs border ${transaction.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                                    transaction.status === "PENDING" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                                        "bg-red-500/20 text-red-300 border-red-500/30"
                                    }`}>
                                    {transaction.status}
                                </div>
                            </div>
                        ))}
                        {stats.recentTransactions.length === 0 && (
                            <p className="text-gray-400 text-center py-4">No transactions found</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
