import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";

async function getStats() {
    const [totalUsers, approvedUsers, pendingUsers, recentUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
            where: { status: "APPROVED" },
        }),
        prisma.user.count({
            where: { status: "PENDING" },
        }),
        prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
        }),
    ]);

    return {
        totalUsers,
        approvedUsers,
        pendingUsers,
        recentUsers,
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

    const stats = await getStats();

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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Total Users</p>
                                <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                            </div>
                        </div>
                    </div>

                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-green-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Approved Users</p>
                                <p className="text-2xl font-bold text-white">{stats.approvedUsers}</p>
                            </div>
                        </div>
                    </div>

                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Pending Users</p>
                                <p className="text-2xl font-bold text-white">{stats.pendingUsers}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Users */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Recent Users</h2>
                    <div className="space-y-4">
                        {stats.recentUsers.map((user) => (
                            <div key={user.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" :
                                    user.status === "PENDING" ? "bg-amber-500/20 text-amber-300" :
                                        "bg-red-500/20 text-red-300"
                                    }`}>
                                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                                </div>
                                <div className="flex-1">
                                    <p className="text-white font-medium">
                                        {user.name || "Unnamed User"}
                                    </p>
                                    <p className="text-gray-400 text-sm">
                                        {user.email} · Joined {new Date(user.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs border ${user.role === "ADMIN" ? "bg-violet-500/20 text-violet-300 border-violet-500/30" :
                                    "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                    }`}>
                                    {user.role}
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs border ${user.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                                    user.status === "PENDING" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                                        "bg-red-500/20 text-red-300 border-red-500/30"
                                    }`}>
                                    {user.status}
                                </div>
                            </div>
                        ))}
                        {stats.recentUsers.length === 0 && (
                            <p className="text-gray-400 text-center py-4">No users found</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
