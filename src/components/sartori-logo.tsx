import logoAsset from "@/assets/sartori-logo.png.asset.json";

export function SartoriLogo({ className = "h-10 w-auto", showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src={logoAsset.url} alt="Sartori Group" className={className} />
      {!showWordmark && <span className="sr-only">Sartori Group</span>}
    </div>
  );
}
