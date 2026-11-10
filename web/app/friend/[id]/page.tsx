import { Suspense } from "react";
import FriendView from "./view";

// URL の id はアクセスされるまで分からないので、Suspense の中で読む
export default function FriendPage() {
  return (
    <Suspense>
      <FriendView />
    </Suspense>
  );
}
