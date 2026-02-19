"use client";

import { useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type InputMode = "url" | "transcript" | "screenshot";

interface ScreenshotFile {
    file: File;
    preview: string;
    base64: string;
}

export default function AIToolsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // Input state
    const [mode, setMode] = useState<InputMode>("url");
    const [videoUrl, setVideoUrl] = useState("");
    const [transcriptText, setTranscriptText] = useState("");
    const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<{
        summary: string;
        notes: string;
        videoId?: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    if (status === "loading") {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!session) {
        router.push("/login");
        return null;
    }

    // ─── File Handling ───────────────────────────────────────────────────────
    const readFileAsBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const addFiles = async (files: FileList | File[]) => {
        const validFiles = Array.from(files).filter((f) =>
            ["image/png", "image/jpeg", "image/webp"].includes(f.type)
        );
        if (screenshots.length + validFiles.length > 5) {
            setError("You can upload a maximum of 5 screenshots.");
            return;
        }
        const newScreenshots: ScreenshotFile[] = [];
        for (const file of validFiles) {
            const base64 = await readFileAsBase64(file);
            newScreenshots.push({
                file,
                preview: URL.createObjectURL(file),
                base64,
            });
        }
        setScreenshots((prev) => [...prev, ...newScreenshots]);
        setError("");
    };

    const removeScreenshot = (index: number) => {
        setScreenshots((prev) => {
            const updated = [...prev];
            URL.revokeObjectURL(updated[index].preview);
            updated.splice(index, 1);
            return updated;
        });
    };

    // ─── Drag and Drop ──────────────────────────────────────────────────────
    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length > 0) {
                addFiles(e.dataTransfer.files);
            }
        },
        [screenshots.length]
    );

    // ─── Submit ──────────────────────────────────────────────────────────────
    const canSubmit = () => {
        if (loading) return false;
        switch (mode) {
            case "url":
                return videoUrl.trim().length > 0;
            case "transcript":
                return transcriptText.trim().length >= 20;
            case "screenshot":
                return screenshots.length > 0;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setResult(null);
        setLoading(true);

        try {
            let body: any = { mode };

            switch (mode) {
                case "url":
                    body.videoUrl = videoUrl;
                    break;
                case "transcript":
                    body.transcriptText = transcriptText;
                    break;
                case "screenshot":
                    body.screenshots = screenshots.map((s) => s.base64);
                    break;
            }

            const res = await fetch("/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Something went wrong.");
                return;
            }

            setResult(data);
        } catch {
            setError("Network error. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    const copyNotes = async () => {
        if (!result) return;
        const fullText = `## Summary\n${result.summary}\n\n## Study Notes\n${result.notes}`;
        await navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ─── Tab Config ─────────────────────────────────────────────────────────
    const tabs: { key: InputMode; icon: string; label: string; desc: string }[] = [
        {
            key: "url",
            icon: "🔗",
            label: "YouTube Link",
            desc: "Paste a YouTube URL to auto-extract the transcript",
        },
        {
            key: "transcript",
            icon: "📝",
            label: "Paste Transcript",
            desc: "Manually paste a transcript if the link doesn't work",
        },
        {
            key: "screenshot",
            icon: "📸",
            label: "Upload Screenshots",
            desc: "Upload screenshots if transcript isn't available",
        },
    ];

    const submitLabels: Record<InputMode, string> = {
        url: "Summarize",
        transcript: "Generate Notes",
        screenshot: "Analyze Screenshots",
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Navigation */}
            <nav className="border-b border-white/10 backdrop-blur-xl bg-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push("/dashboard")}
                                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                            >
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-purple-600 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                </div>
                                <span className="text-xl font-bold text-white">Dashboard</span>
                            </button>
                            <span className="text-gray-500 mx-2">/</span>
                            <span className="text-lg font-semibold text-violet-400">AI Tools</span>
                        </div>
                        <span className="text-gray-300">{session.user?.email}</span>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-500/30 rounded-2xl p-6 mb-8">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">YouTube Video Summarizer</h1>
                            <p className="text-gray-400">Paste a YouTube link, a transcript, or upload screenshots → Get AI-powered summary &amp; study notes</p>
                        </div>
                    </div>
                </div>

                {/* Tab Selector */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => {
                                setMode(tab.key);
                                setError("");
                                setResult(null);
                            }}
                            className={`relative group p-4 rounded-2xl border text-left transition-all duration-300 ${mode === tab.key
                                    ? "bg-violet-600/20 border-violet-500/50 shadow-lg shadow-violet-500/10"
                                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{tab.icon}</span>
                                <span className={`font-semibold text-sm ${mode === tab.key ? "text-violet-300" : "text-gray-300"}`}>
                                    {tab.label}
                                </span>
                            </div>
                            <p className={`text-xs leading-snug ${mode === tab.key ? "text-violet-400/80" : "text-gray-500"}`}>
                                {tab.desc}
                            </p>
                            {mode === tab.key && (
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-violet-500 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Input Form */}
                <form onSubmit={handleSubmit} className="mb-8">
                    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                        {/* URL Input */}
                        {mode === "url" && (
                            <>
                                <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-300 mb-3">
                                    YouTube Video URL
                                </label>
                                <div className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                            </svg>
                                        </div>
                                        <input
                                            id="videoUrl"
                                            type="url"
                                            value={videoUrl}
                                            onChange={(e) => setVideoUrl(e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                            disabled={loading}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!canSubmit()}
                                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 min-w-[160px] justify-center"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                {submitLabels[mode]}
                                            </>
                                        )}
                                    </button>
                                </div>
                                <p className="text-gray-500 text-xs mt-2">
                                    Supports youtube.com and youtu.be links. The video must have captions/subtitles.
                                </p>
                            </>
                        )}

                        {/* Transcript Input */}
                        {mode === "transcript" && (
                            <>
                                <label htmlFor="transcriptText" className="block text-sm font-medium text-gray-300 mb-3">
                                    Paste Your Transcript
                                </label>
                                <textarea
                                    id="transcriptText"
                                    value={transcriptText}
                                    onChange={(e) => setTranscriptText(e.target.value)}
                                    placeholder="Paste the video transcript or any educational text here..."
                                    rows={10}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-y min-h-[160px]"
                                    disabled={loading}
                                />
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-gray-500 text-xs">
                                        Minimum 20 characters •{" "}
                                        <span className={transcriptText.length >= 20 ? "text-emerald-400" : "text-gray-500"}>
                                            {transcriptText.length} characters
                                        </span>
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={!canSubmit()}
                                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 min-w-[180px] justify-center"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                {submitLabels[mode]}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Screenshot Input */}
                        {mode === "screenshot" && (
                            <>
                                <label className="block text-sm font-medium text-gray-300 mb-3">
                                    Upload Screenshots
                                </label>
                                {/* Drop Zone */}
                                <div
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOver(true);
                                    }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${dragOver
                                            ? "border-violet-500 bg-violet-500/10"
                                            : "border-white/20 bg-white/5 hover:border-violet-500/50 hover:bg-white/8"
                                        }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files) addFiles(e.target.files);
                                            e.target.value = "";
                                        }}
                                        disabled={loading}
                                    />
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                                            <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-gray-300 font-medium">
                                                Drop screenshots here or{" "}
                                                <span className="text-violet-400 underline">browse</span>
                                            </p>
                                            <p className="text-gray-500 text-xs mt-1">
                                                PNG, JPG, or WebP • Max 5 images
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Screenshot Previews */}
                                {screenshots.length > 0 && (
                                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {screenshots.map((ss, idx) => (
                                            <div
                                                key={idx}
                                                className="relative group rounded-xl overflow-hidden border border-white/10 bg-white/5"
                                            >
                                                <img
                                                    src={ss.preview}
                                                    alt={`Screenshot ${idx + 1}`}
                                                    className="w-full h-32 object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeScreenshot(idx);
                                                    }}
                                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                                    <p className="text-xs text-gray-300 truncate">{ss.file.name}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-gray-500 text-xs">
                                        {screenshots.length} / 5 screenshots uploaded
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={!canSubmit()}
                                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 min-w-[200px] justify-center"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                {submitLabels[mode]}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </form>

                {/* Error Message */}
                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-red-300">{error}</p>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="mb-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                        <div className="animate-spin w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                            {mode === "screenshot" ? "Analyzing Screenshots..." : "Analyzing Content..."}
                        </h3>
                        <p className="text-gray-400">
                            {mode === "screenshot"
                                ? "Extracting text from images and generating AI-powered notes. This may take 15-30 seconds."
                                : "Processing and generating AI-powered notes. This may take 10-20 seconds."}
                        </p>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="space-y-6">
                        {/* Video Preview (URL mode only) */}
                        {result.videoId && (
                            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                <div className="aspect-video">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${result.videoId}`}
                                        className="w-full h-full"
                                        allowFullScreen
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-green-500 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-white">Summary</h2>
                            </div>
                            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{result.summary}</p>
                        </div>

                        {/* Study Notes */}
                        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-500 to-purple-500 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                    <h2 className="text-xl font-bold text-white">Study Notes</h2>
                                </div>
                                <button
                                    onClick={copyNotes}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all text-sm"
                                >
                                    {copied ? (
                                        <>
                                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                            </svg>
                                            Copy Notes
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="text-gray-300 leading-relaxed prose prose-invert max-w-none whitespace-pre-wrap">
                                {result.notes}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
