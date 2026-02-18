"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";

// Define simpler interfaces for the component
interface Chunk {
    id: string;
}

interface Document {
    id: string;
    name: string;
    createdAt: string;
    _count: {
        chunks: number;
    };
}

interface Workspace {
    id: string;
    name: string;
    documents: Document[];
}

interface Message {
    role: "user" | "assistant";
    content: string;
    sources?: string[];
}

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: workspaceId } = use(params);
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [includeWebSearch, setIncludeWebSearch] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchWorkspace();
    }, [workspaceId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchWorkspace = async () => {
        const res = await fetch(`/api/workspaces/${workspaceId}`);
        if (res.ok) {
            const data = await res.json();
            setWorkspace(data);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setUploading(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/upload`, {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                await fetchWorkspace(); // Refresh documents
            } else {
                const error = await res.json();
                alert(`Upload failed: ${error.error}`);
            }
        } catch (err) {
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input;
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setLoading(true);

        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage, includeWebSearch }),
            });

            if (res.ok) {
                const data = await res.json();
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: data.answer, sources: data.sources },
                ]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "Sorry, I encountered an error answering that." },
                ]);
            }
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, I encountered an error answering that." },
            ]);
        } finally {
            setLoading(false);
        }
    };

    if (!workspace) return <div className="p-10 text-center">Loading workspace...</div>;

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
            {/* Sidebar: Documents */}
            <div className="w-80 bg-gray-50 border-r flex flex-col p-4 overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">{workspace.name}</h2>

                <div className="mb-6">
                    <label className="block w-full cursor-pointer bg-blue-100 hover:bg-blue-200 text-blue-700 text-center px-4 py-2 rounded-lg font-medium transition-colors border-2 border-dashed border-blue-300">
                        {uploading ? "Processing..." : "+ Upload Document"}
                        <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.txt,.md"
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                    </label>
                    <p className="text-xs text-gray-400 mt-2 text-center">Supports PDF, TXT, MD</p>
                </div>

                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wider">Documents ({workspace.documents.length})</h3>
                    <ul className="space-y-2">
                        {workspace.documents.map((doc) => (
                            <li key={doc.id} className="text-sm bg-white p-2 rounded border shadow-sm">
                                <div className="font-medium truncate">{doc.name}</div>
                                <div className="text-xs text-gray-400">
                                    {new Date(doc.createdAt).toLocaleDateString()}
                                </div>
                            </li>
                        ))}
                        {workspace.documents.length === 0 && (
                            <li className="text-sm text-gray-400 italic text-center p-4">No documents yet.</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Main Area: Chat */}
            <div className="flex-1 flex flex-col bg-white">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <p className="text-xl font-medium mb-2">Ask questions about your documents</p>
                            <p>Upload a file and start chatting.</p>
                        </div>
                    )}
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex flex-col max-w-3xl ${msg.role === "user" ? "self-end items-end ml-auto" : "self-start items-start mr-auto"
                                }`}
                        >
                            <div
                                className={`p-4 rounded-2xl ${msg.role === "user"
                                        ? "bg-blue-600 text-white rounded-br-none"
                                        : "bg-gray-100 text-gray-800 rounded-bl-none"
                                    }`}
                            >
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>

                            {/* Sources */}
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-2 text-xs">
                                    <span className="font-semibold text-gray-500 mr-2">Sources:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {msg.sources.map((source, i) => (
                                            <span key={i} className="inline-block bg-gray-100 border px-2 py-0.5 rounded text-gray-600">
                                                {source}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-white">
                    <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer bg-gray-50 px-3 py-1 rounded-full border hover:bg-gray-100">
                                <input
                                    type="checkbox"
                                    checked={includeWebSearch}
                                    onChange={(e) => setIncludeWebSearch(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span>Enable Deep Search (Web)</span>
                            </label>
                            {includeWebSearch && <span className="text-xs text-orange-500 font-medium">✨ Powered by Firecrawl</span>}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Ask a question..."
                                className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                            >
                                {loading ? "Thinking..." : "Send"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
