import { Suspense } from "react";
import MeView from "./view";

// URL の id はアクセスされるまで分からないので、Suspense の中で読む
export default function MePage() {
  return (
    <Suspense>
      <MeView />
    </Suspense>
  );
}
