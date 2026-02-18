"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    createdAt: string;
}

export default function ManageUsersPage() {
    const { data: session } = useSession();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            if (res.ok) {
                setUsers(data.users);
            }
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (userId: string, status: string) => {
        setActionLoading(userId);
        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, status }),
            });
            if (res.ok) {
                await fetchUsers(); // Refresh list
            }
        } catch (error) {
            console.error("Failed to update user:", error);
        } finally {
            setActionLoading(null);
        }
    };

    if (!session || session.user.role !== "ADMIN") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <p className="text-xl font-bold">Unauthorized. Admins only.</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-950">
            <Sidebar user={session.user} />

            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                <header className="p-6 border-b border-white/10 bg-white/5 backdrop-blur-xl">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                Manage Users
                            </h1>
                            <p className="text-gray-400 text-xs mt-1 font-bold uppercase tracking-widest">Platform Administration & Governance</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <div className="max-w-7xl mx-auto">
                        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/10">
                                            <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500">User</th>
                                            <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500">Role</th>
                                            <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500">Status</th>
                                            <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500">Joined</th>
                                            <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-500 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={5} className="p-12 text-center text-gray-500 font-medium">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                                                        Loading users...
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : users.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-12 text-center text-gray-500">No users found.</td>
                                            </tr>
                                        ) : (
                                            users.map((user) => (
                                                <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white ${user.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "bg-white/10"
                                                                }`}>
                                                                {user.name?.[0] || user.email[0].toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-white font-bold truncate">{user.name || "Unnamed User"}</p>
                                                                <p className="text-gray-500 text-xs truncate">{user.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${user.role === "ADMIN"
                                                                ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                                                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                            }`}>
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${user.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                                user.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                                    "bg-red-500/10 text-red-400 border-red-500/20"
                                                            }`}>
                                                            {user.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-xs font-bold text-gray-500 tabular-nums">
                                                        {new Date(user.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {user.status !== "APPROVED" && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(user.id, "APPROVED")}
                                                                    disabled={actionLoading === user.id}
                                                                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all font-bold text-xs flex items-center gap-1.5"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                    Approve
                                                                </button>
                                                            )}
                                                            {user.status !== "REJECTED" && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(user.id, "REJECTED")}
                                                                    disabled={actionLoading === user.id}
                                                                    className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all font-bold text-xs flex items-center gap-1.5"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                    Reject
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
