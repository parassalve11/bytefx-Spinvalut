import Image from "next/image";
import logo from "@/assets/logo/bytefx.webp";
import Button from "@/components/ui/Button";

export default function WorkspaceLoading({ error, onRetry }) {
  return (
    <main className="workspace-loading draw-page" aria-busy={!error}>
      <div className="loading-card">
        <Image src={logo} alt="ByteFX" width={156} priority className="h-auto w-36" />
        {error ? (
          <>
            <p role="alert" className="max-w-sm text-center text-sm leading-relaxed text-text-primary">{error}</p>
            <Button onClick={onRetry}>Try again</Button>
          </>
        ) : (
          <div role="status" aria-label="Loading" className="loading-track"><span /></div>
        )}
      </div>
    </main>
  );
}
