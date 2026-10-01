import Link from "next/link";
import { CrossMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <CrossMark className="h-10 w-10" />
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <Link href="/" className="text-sm font-medium underline">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
