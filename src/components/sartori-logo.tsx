import logoAsset from "@/assets/sartori-logo.png.asset.json";
import logoTransparent from "@/assets/sartori-logo-transparent.png.asset.json";

export function SartoriLogo({
  className = "h-10 w-auto",
  showWordmark = true,
  variant = "default",
}: {
  className?: string;
  showWordmark?: boolean;
  variant?: "default" | "transparent";
}) {
  const src = variant === "transparent" ? logoTransparent.url : logoAsset.url;
  return (
    <div className="flex items-center gap-2">
      <img src={src} alt="Sartori Group" className={className} />
      {!showWordmark && <span className="sr-only">Sartori Group</span>}
    </div>
  );
}
