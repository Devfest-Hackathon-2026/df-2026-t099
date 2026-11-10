"""予算の通知（Pub/Sub）を受け取り、使った額に応じて2段階で止める。

1. 予算の AI_STOP_RATIO（70%）に達したら、AI（Gemini）だけを止める。
   Firestore の config/ai に disabled: true を書き、アプリはそれを見て Gemini を呼ばなくなる。
   お金がかかるのはほとんど Gemini なので、これで増え方がほぼ止まる。アプリのほかの部分は動き続ける。
2. それでも STOP_RATIO（90%）に達したら、プロジェクトの課金を止める。
   Cloud Run・Vertex AI など有料のサービスはすべて止まる。
再開のしかたは ops/billing-guard/README.md。
"""

import base64
import datetime
import json
import os

import functions_framework
from google.cloud import billing_v1, firestore

PROJECT_ID = os.environ["TARGET_PROJECT_ID"]
# 通知は数時間遅れることがあるので、どちらも 1.0 より手前にしておく
AI_STOP_RATIO = float(os.environ.get("AI_STOP_RATIO", "0.7"))
STOP_RATIO = float(os.environ.get("STOP_RATIO", "0.9"))


def pause_ai(cost: float, budget: float) -> None:
    ref = firestore.Client(project=PROJECT_ID).collection("config").document("ai")
    snap = ref.get()
    if snap.exists and snap.to_dict().get("disabled") is True:
        print("AI はすでに止めている")
        return
    ref.set(
        {
            "disabled": True,
            "reason": f"予算の {AI_STOP_RATIO:.0%} に達した（{cost} / {budget}）",
            "at": datetime.datetime.now(datetime.timezone.utc),
        }
    )
    print(f"AI を止めた（{cost} / {budget}）")


def stop_billing_now(cost: float, budget: float, currency: str) -> None:
    client = billing_v1.CloudBillingClient()
    name = f"projects/{PROJECT_ID}"
    if not client.get_project_billing_info(name=name).billing_enabled:
        print(f"課金はすでに止まっている: {name}")
        return
    client.update_project_billing_info(
        name=name,
        project_billing_info=billing_v1.ProjectBillingInfo(billing_account_name=""),
    )
    print(f"課金を止めた: {name}（{cost} / {budget} {currency}）")


@functions_framework.cloud_event
def stop_billing(cloud_event):
    message = base64.b64decode(cloud_event.data["message"]["data"]).decode("utf-8")
    notice = json.loads(message)
    cost = float(notice["costAmount"])
    budget = float(notice["budgetAmount"])
    currency = notice.get("currencyCode", "")

    if cost < budget * AI_STOP_RATIO:
        print(f"上限まで余裕あり: {cost} / {budget} {currency}（{AI_STOP_RATIO:.0%} で AI を止める）")
        return

    # AI を止める印が書けなくても（権限がないなど）、課金を止める段階は必ず続ける
    try:
        pause_ai(cost, budget)
    except Exception as e:  # noqa: BLE001
        print(f"AI を止める印を書けなかった: {e}")

    if cost >= budget * STOP_RATIO:
        stop_billing_now(cost, budget, currency)
