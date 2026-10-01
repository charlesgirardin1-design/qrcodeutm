import { LoginForm } from "@/components/layout/login-form";
import { CrossMark } from "@/components/brand/logo";

export const metadata = { title: "Connexion — Photothèque Croix-Rouge" };

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border bg-white shadow-sm">
            <CrossMark className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Photothèque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Croix-Rouge française
            <br />
            Unité locale de Boulogne-Billancourt
          </p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accès réservé aux bénévoles de l&apos;unité locale.
        </p>
      </div>
    </div>
  );
}
