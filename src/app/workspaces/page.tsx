"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Workspace {
    id: string;
    name: string;
    createdAt: string;
    _count: {
        documents: number;
    };
}

export default function WorkspacesPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const fetchWorkspaces = async () => {
        const res = await fetch("/api/workspaces");
        if (res.ok) {
            const data = await res.json();
            setWorkspaces(data);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWorkspaceName.trim()) return;

        setLoading(true);
        try {
            const res = await fetch("/api/workspaces", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newWorkspaceName }),
            });

            if (res.ok) {
                const workspace = await res.json();
                setWorkspaces([workspace, ...workspaces]);
                setNewWorkspaceName("");
                router.push(`/workspaces/${workspace.id}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">AI Workspaces</h1>

            {/* Create Workspace */}
            <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
                <h2 className="text-xl font-semibold mb-4">Create New Workspace</h2>
                <form onSubmit={handleCreate} className="flex gap-4">
                    <input
                        type="text"
                        placeholder="Workspace Name (e.g., 'Q1 Financial Reports')"
                        className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !newWorkspaceName.trim()}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Creating..." : "Create Workspace"}
                    </button>
                </form>
            </div>

            {/* Workspace List */}
            <h2 className="text-xl font-semibold mb-4">Your Workspaces</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {workspaces.map((workspace) => (
                    <Link
                        key={workspace.id}
                        href={`/workspaces/${workspace.id}`}
                        className="block bg-white p-6 rounded-lg border hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <h3 className="text-lg font-bold mb-2 truncate">{workspace.name}</h3>
                        <p className="text-gray-500 text-sm">
                            {workspace._count?.documents || 0} Documents
                        </p>
                        <p className="text-gray-400 text-xs mt-4">
                            Created {new Date(workspace.createdAt).toLocaleDateString()}
                        </p>
                    </Link>
                ))}

                {workspaces.length === 0 && (
                    <div className="text-gray-500 col-span-full text-center py-10">
                        No workspaces yet. Create one to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
