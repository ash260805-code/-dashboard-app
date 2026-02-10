"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    createdAt: string;
}

export default function AdminPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        if (status === "loading") return;
        if (!session || session.user.role !== "ADMIN") {
            router.push("/dashboard");
            return;
        }
        fetchUsers();
    }, [session, status, router]);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            setUsers(data.users || []);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateUserStatus = async (userId: string, newStatus: string) => {
        setUpdating(userId);
        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, status: newStatus }),
            });

            if (res.ok) {
                setUsers(users.map(u =>
                    u.id === userId ? { ...u, status: newStatus } : u
                ));
            }
        } catch (error) {
            console.error("Error updating user:", error);
        } finally {
            setUpdating(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "APPROVED": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
            case "REJECTED": return "bg-red-500/20 text-red-300 border-red-500/30";
            default: return "bg-amber-500/20 text-amber-300 border-amber-500/30";
        }
    };

    const stats = {
        total: users.length,
        pending: users.filter(u => u.status === "PENDING").length,
        approved: users.filter(u => u.status === "APPROVED").length,
        rejected: users.filter(u => u.status === "REJECTED").length,
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Navigation */}
            <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-purple-600 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-white">Admin Panel</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-sm border border-violet-500/30">
                                Admin
                            </span>
                            <span className="text-gray-300">{session?.user?.email}</span>
                            <button
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm">Total Users</p>
                        <p className="text-3xl font-bold text-white">{stats.total}</p>
                    </div>
                    <div className="backdrop-blur-xl bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                        <p className="text-amber-300 text-sm">Pending</p>
                        <p className="text-3xl font-bold text-amber-100">{stats.pending}</p>
                    </div>
                    <div className="backdrop-blur-xl bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
                        <p className="text-emerald-300 text-sm">Approved</p>
                        <p className="text-3xl font-bold text-emerald-100">{stats.approved}</p>
                    </div>
                    <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
                        <p className="text-red-300 text-sm">Rejected</p>
                        <p className="text-3xl font-bold text-red-100">{stats.rejected}</p>
                    </div>
                </div>

                {/* Users Table */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-bold text-white">User Management</h2>
                        <p className="text-gray-400 text-sm mt-1">Manage user access and approvals</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="text-white font-medium">{user.name || "No name"}</p>
                                                <p className="text-gray-400 text-sm">{user.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs border ${user.role === "ADMIN"
                                                    ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                                                    : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs border ${getStatusColor(user.status)}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.role !== "ADMIN" && (
                                                <div className="flex gap-2">
                                                    {user.status !== "APPROVED" && (
                                                        <button
                                                            onClick={() => updateUserStatus(user.id, "APPROVED")}
                                                            disabled={updating === user.id}
                                                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-all text-sm disabled:opacity-50"
                                                        >
                                                            {updating === user.id ? "..." : "Approve"}
                                                        </button>
                                                    )}
                                                    {user.status !== "REJECTED" && (
                                                        <button
                                                            onClick={() => updateUserStatus(user.id, "REJECTED")}
                                                            disabled={updating === user.id}
                                                            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all text-sm disabled:opacity-50"
                                                        >
                                                            {updating === user.id ? "..." : "Reject"}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                            No users found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
