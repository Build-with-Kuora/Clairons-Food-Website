import type { Metadata } from "next";
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
      </div>
    </main>
  );
}
