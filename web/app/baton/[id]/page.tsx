import { Suspense } from "react";
import BatonView from "./view";

// URL の id はアクセスされるまで分からないので、Suspense の中で読む
export default function BatonPage() {
  return (
    <Suspense>
      <BatonView />
    </Suspense>
  );
}
