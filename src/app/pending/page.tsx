import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function PendingPage() {
    const session = await auth();

    if (!session) {
        redirect("/login");
    }

    if (session.user.status === "APPROVED") {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-amber-900/30 to-slate-900">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgMHYyaC0ydi0yaDJ6bTIgMGgydjJoLTJ2LTJ6bS0yIDRoMnYyaC0ydi0yem0yLThoMnYyaC0ydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40"></div>

            <div className="relative w-full max-w-md px-6">
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 shadow-lg mb-6">
                        <svg className="w-10 h-10 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-4">Pending Approval</h1>

                    <p className="text-gray-300 mb-6">
                        Hi <span className="font-semibold text-amber-300">{session.user.name || session.user.email}</span>!
                        <br /><br />
                        Your account is pending approval from an administrator. You&apos;ll be able to access the dashboard once your account has been approved.
                    </p>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-center gap-2 text-amber-200">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm">This usually takes 24-48 hours</span>
                        </div>
                    </div>

                    <Link
                        href="/api/auth/signout"
                        className="inline-flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                    </Link>
                </div>
            </div>
        </div>
    );
}
