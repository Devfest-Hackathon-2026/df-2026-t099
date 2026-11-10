import { Suspense } from "react";
import CompareView from "./view";

// URL の id はアクセスされるまで分からないので、Suspense の中で読む
export default function ComparePage() {
  return (
    <Suspense>
      <CompareView />
    </Suspense>
  );
}
