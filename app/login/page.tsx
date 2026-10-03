import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Log in | Clairon's Foods",
};

export default function Login() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex justify-center">
          <Logo height={72} />
        </div>
        <AuthForm />
        <p className="mt-5 text-center text-[14px] text-ink-2">
          Buying for home or your store?{" "}
          <Link href="/shop" className="font-semibold text-brand hover:text-brand-hover hover:underline">
            Shop online
          </Link>
        </p>
      </div>
    </main>
  );
}
