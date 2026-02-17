"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Message {
    role: "user" | "ai";
    content: string;
}

export default function DocsPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [documentId, setDocumentId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const router = useRouter();
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/documents/upload", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Upload failed");

            setDocumentId(data.documentId);
            setSuccessMsg(`Success! Processed ${data.chunkCount} parts of "${file.name}".`);
            setMessages([{ role: "ai", content: `I've read "${file.name}". What would you like to know about it?` }]);
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !documentId || loading) return;

        const userMsg = input;
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setLoading(true);

        try {
            const res = await fetch("/api/documents/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg, documentId }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to get answer");

            setMessages(prev => [...prev, { role: "ai", content: data.answer }]);
            setTimeout(scrollToBottom, 50);
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-t border-white/10">
            <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-2 text-white hover:text-violet-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </Link>
                    <span className="text-white font-bold">📄 Document Q&A (RAG)</span>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto p-4 md:p-8">
                {/* Upload Section */}
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <span className="p-2 bg-blue-500/20 rounded-lg">📤</span>
                        Step 1: Upload Document
                    </h2>
                    <form onSubmit={handleUpload} className="space-y-4">
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-violet-500/50 hover:bg-white/5 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <p className="text-sm text-gray-400">
                                        {file ? <span className="text-violet-400 font-medium">{file.name}</span> : "Click to upload PDF or Text file"}
                                    </p>
                                </div>
                                <input type="file" className="hidden" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                            </label>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={!file || uploading}
                                className={`px-6 py-2 rounded-xl font-medium transition-all ${!file || uploading
                                        ? "bg-white/10 text-gray-500 cursor-not-allowed"
                                        : "bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:shadow-lg hover:shadow-blue-500/25 active:scale-95"
                                    }`}
                            >
                                {uploading ? "Processing..." : "Read Document"}
                            </button>
                        </div>
                    </form>
                    {successMsg && <p className="mt-4 text-emerald-400 text-sm bg-emerald-400/10 p-3 rounded-lg border border-emerald-400/20">✅ {successMsg}</p>}
                    {errorMsg && <p className="mt-4 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">❌ {errorMsg}</p>}
                </div>

                {/* Chat Section */}
                <div className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all ${documentId ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
                    <div className="p-6 border-b border-white/10 bg-white/5">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="p-2 bg-purple-500/20 rounded-lg">💬</span>
                            Step 2: Ask Questions
                        </h2>
                    </div>

                    <div className="h-[400px] overflow-y-auto p-6 space-y-4">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <p>Upload a document first to start chatting.</p>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === "user"
                                        ? "bg-violet-600 text-white rounded-br-none"
                                        : "bg-white/10 text-gray-200 border border-white/10 rounded-bl-none"
                                    } shadow-lg`}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white/10 p-4 rounded-2xl rounded-bl-none border border-white/10">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                        <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-white/5">
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={documentId ? "Ask a question about the document..." : "Upload a document above first..."}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-all"
                                disabled={!documentId || loading}
                            />
                            <button
                                type="submit"
                                disabled={!documentId || !input.trim() || loading}
                                className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-tr from-violet-500 to-purple-600 text-white disabled:opacity-30 transition-all hover:scale-105"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
