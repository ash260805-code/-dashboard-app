"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useSession } from "next-auth/react";

interface Message {
    role: "user" | "assistant";
    content: string;
    sources?: string[];
}

export default function DeepSearchPage() {
    const { data: session } = useSession();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input;
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
        setLoading(true);

        try {
            const res = await fetch("/api/deep-search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: userMsg }),
            });

            if (res.ok) {
                const data = await res.json();
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: data.answer, sources: data.sources },
                ]);
            } else {
                throw new Error("Search failed");
            }
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "I encountered an error searching the web. Please try again." },
            ]);
        } finally {
            setLoading(false);
        }
    };

    if (!session) return null;

    return (
        <div className="flex min-h-screen bg-slate-950">
            <Sidebar user={session.user} />

            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                {/* Header */}
                <header className="p-6 border-b border-white/10 bg-white/5 backdrop-blur-xl">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Deep Search
                            </h1>
                            <p className="text-gray-400 text-xs mt-1 font-bold uppercase tracking-widest">Global Web Intelligence Powered by Firecrawl</p>
                        </div>
                    </div>
                </header>

                {/* Chat Display */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <div className="max-w-4xl mx-auto space-y-8">
                        {messages.length === 0 && (
                            <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-20 h-20 rounded-full bg-violet-500/20 flex items-center justify-center animate-pulse">
                                    <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-black text-white">How can I help you research today?</h2>
                                <p className="text-gray-500 max-w-md">Enter any topic and I'll scour the web to find the most relevant, up-to-date information for you.</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-3xl p-6 shadow-2xl ${msg.role === "user"
                                        ? "bg-violet-600 text-white rounded-br-none"
                                        : "bg-white/5 border border-white/10 text-gray-200 rounded-bl-none backdrop-blur-xl"
                                    }`}>
                                    <div className="whitespace-pre-wrap text-lg leading-relaxed">{msg.content}</div>

                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className="mt-6 pt-4 border-t border-white/10">
                                            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Research Sources:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {msg.sources.map((source, i) => (
                                                    <span key={i} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-violet-400 font-bold max-w-[200px] truncate">
                                                        {source}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                {/* Search Bar */}
                <div className="p-6 bg-slate-900/50 backdrop-blur-2xl border-t border-white/10">
                    <form onSubmit={handleSearch} className="max-w-4xl mx-auto flex items-center gap-4">
                        <div className="flex-1 relative group">
                            <input
                                type="text"
                                placeholder="Search the web for anything..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all text-lg font-medium"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={loading}
                            />
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500 group-focus-within:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:hover:bg-violet-600 text-white font-black px-8 py-4 rounded-2xl transition-all shadow-xl shadow-violet-600/20 active:scale-95"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    <span>Searching...</span>
                                </div>
                            ) : (
                                "Analyze"
                            )}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
