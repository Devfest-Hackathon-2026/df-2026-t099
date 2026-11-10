import { Suspense } from "react";
import GroupView from "./view";

// URL の id はアクセスされるまで分からないので、Suspense の中で読む
export default function GroupPage() {
  return (
    <Suspense>
      <GroupView />
    </Suspense>
  );
}
