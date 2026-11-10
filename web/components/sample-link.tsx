"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { saveDiagnosis } from "@/lib/diagnosis-store";
import { SAMPLE_VIDEOS } from "@/lib/sample-diagnosis";

// 何も入力せずに結果の画面を見る（審査員・初めての人向け）。Apple のページの「詳しく見る ›」の形
export function SampleLink() {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        saveDiagnosis("sample", SAMPLE_VIDEOS);
        router.push("/result");
      }}
      className="inline-flex items-center gap-0.5 text-[17px] text-accent transition hover:underline"
    >
      例の結果を見る
      <ChevronRight size={18} aria-hidden />
    </button>
  );
}
