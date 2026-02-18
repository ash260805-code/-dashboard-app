import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

async function getStats() {
    const [totalUsers, approvedUsers, pendingUsers, recentUsers, recentWorkspaces] = await Promise.all([
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
        (prisma as any).workspace.findMany({
            orderBy: { updatedAt: "desc" },
            take: 5,
            include: { _count: { select: { documents: true } } }
        }),
    ]);

    return {
        totalUsers,
        approvedUsers,
        pendingUsers,
        recentUsers,
        recentWorkspaces,
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
        <div className="flex min-h-screen bg-slate-950">
            {/* Sidebar Navigation */}
            <Sidebar user={session.user} />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Header Section */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>
                            <p className="text-gray-400 mt-1">Welcome back, {session.user.name || "User"}!</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium">
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        <div className="group relative overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 transition-all hover:border-blue-500/50">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Total Users</p>
                            <p className="text-4xl font-black text-white">{stats.totalUsers}</p>
                            <div className="mt-4 flex items-center text-xs text-blue-400 font-bold bg-blue-400/10 px-2 py-1 rounded-lg w-fit">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                System Wide
                            </div>
                        </div>

                        <div className="group relative overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 transition-all hover:border-emerald-500/50">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Approved</p>
                            <p className="text-4xl font-black text-white">{stats.approvedUsers}</p>
                            <div className="mt-4 flex items-center text-xs text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded-lg w-fit">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Verified Access
                            </div>
                        </div>

                        <div className="group relative overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 transition-all hover:border-amber-500/50">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                <svg className="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Pending</p>
                            <p className="text-4xl font-black text-white">{stats.pendingUsers}</p>
                            <div className="mt-4 flex items-center text-xs text-amber-400 font-bold bg-amber-400/10 px-2 py-1 rounded-lg w-fit">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                                </svg>
                                Awaiting Action
                            </div>
                        </div>
                    </div>

                    {/* Workspaces Section */}
                    <div className="mb-10">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Recent Workspaces
                            </h2>
                            <Link
                                href="/workspaces"
                                className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-500 transition-all flex items-center gap-2 shadow-lg shadow-violet-600/20"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                New Workspace
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {stats.recentWorkspaces.map((workspace: any) => (
                                <Link href={`/workspaces/${workspace.id}`} key={workspace.id} className="group">
                                    <div className="h-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-violet-500/50 transition-all hover:-translate-y-1">
                                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-violet-400 transition-colors truncate">{workspace.name}</h3>
                                        <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                            <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg">
                                                <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                {workspace._count.documents} Docs
                                            </span>
                                            <span>Updated {new Date(workspace.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            {stats.recentWorkspaces.length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-white/10 rounded-3xl bg-white/2">
                                    No active workspaces found.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Section: Recent Users */}
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl overflow-hidden mb-8">
                        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                Recent Platform Activity
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            {stats.recentUsers.map((user: any) => (
                                <div key={user.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/10">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${user.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-400" :
                                        user.status === "PENDING" ? "bg-amber-500/20 text-amber-400" :
                                            "bg-red-500/20 text-red-400"
                                        }`}>
                                        {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold truncate">
                                            {user.name || "Unnamed User"}
                                        </p>
                                        <p className="text-gray-500 text-sm truncate">
                                            {user.email} · Registered {new Date(user.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-2">
                                        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${user.role === "ADMIN" ? "bg-violet-500/10 text-violet-400 border-violet-500/20" :
                                            "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                            }`}>
                                            {user.role}
                                        </div>
                                        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${user.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                            user.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                "bg-red-500/10 text-red-400 border-red-500/20"
                                            }`}>
                                            {user.status}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {stats.recentUsers.length === 0 && (
                                <p className="text-gray-500 text-center py-8 font-medium">No recent user activity logs.</p>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

