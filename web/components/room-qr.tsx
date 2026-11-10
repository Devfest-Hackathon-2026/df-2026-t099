"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X } from "lucide-react";
import { formatPercent } from "@/lib/bubble-metrics";

// 会場のスクリーンに大きく出す QR。読み込んだ人がカードで診断して保存すると、グループの地図に加わる
export function RoomQr({
  url,
  name,
  n,
  coverage,
  onClose,
}: {
  url: string;
  name: string;
  n: number;
  coverage?: number;
  onClose: () => void;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: "#06101d", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 p-6 backdrop-blur">
      <button onClick={onClose} aria-label="閉じる" className="absolute right-4 top-4 grid size-11 place-items-center text-muted hover:text-foreground">
        <X size={28} aria-hidden />
      </button>
      <h2 className="text-center text-3xl font-bold sm:text-4xl">{name}の診断に参加する</h2>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="参加用の QR コード" className="size-[min(70vw,360px)] rounded-(--r-inner)" />
      ) : (
        <div className="size-[min(70vw,360px)] rounded-(--r-inner) bg-surface" />
      )}
      <p className="text-center text-lg">
        いま <span className="num text-4xl font-bold text-accent">{n}</span> 人が参加しています。
        {coverage !== undefined && n > 0 && (
          <>
            全員を合わせたかたよりの少なさは <span className="num font-bold text-accent">{formatPercent(coverage)}%</span> です。
          </>
        )}
      </p>
      <p className="max-w-md text-center text-sm text-muted">
        スマートフォンで読み込み、カードに答えて「保存して比べる」を押すと、参加した人の数が増えます。
        {coverage !== undefined && n > 0 && "かたよりの少なさは、すべての話題が同じだけ出てくると 100% になります。"}
      </p>
    </div>
  );
}
