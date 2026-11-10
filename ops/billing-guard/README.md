# billing-guard（使いすぎたら、まず AI を止め、それでもなら課金を止める）

Cloud Credit（1チーム $20）を超えてカードに請求されないように、上限が近づいたらプロジェクトの課金を自動で止める。

## しくみ

```
予算（Cloud Billing Budgets） → Pub/Sub トピック budget-alerts → Cloud Run functions billing-guard → プロジェクトの課金を外す
```

| 項目 | 設定 |
|---|---|
| プロジェクト | `kurohanpen-devfest26` |
| 請求先アカウント | `DevFest 黒はんぺん`（ハッカソン専用。ほかのプロジェクトはつながない） |
| 予算 | 月 3,000 円（$20 の目安）。**クレジットを引く前の額**で数える |
| メール通知 | 50%・90%・100% で請求先アカウントの管理者に届く |
| AI の停止 | 使った額が予算の 70%（2,100 円）に達したら、Firestore の `config/ai` に `disabled: true` を書く（`AI_STOP_RATIO`）。アプリは Gemini を呼ばなくなり、「いまは AI を休ませています」と出す。カードの診断など、ほかの部分は動く |
| 自動停止 | それでも予算の 90%（2,700 円）に達したら課金を外す（`STOP_RATIO`） |
| 関数の実行用アカウント | `billing-guard@kurohanpen-devfest26.iam.gserviceaccount.com`（プロジェクト課金管理者・参照者・Cloud Run 起動元・Cloud Datastore ユーザー） |
| アプリ側の上限 | アプリも、Gemini を呼ぶ回数を日本時間の1日ごとに Firestore の `usage/YYYY-MM-DD` に数え、1,500 回（`GEMINI_DAILY_LIMIT`）を超えたら AI を休ませる |

2026-11-06 に試験済み：予算 3,000 円に対して 100 円の通知では何もせず、2,800 円の通知で課金が外れた（その後つなぎ直した）。参照者（`roles/browser`）がないと、課金の状態を読むところで権限エラーになる。

90% で止めるのは、予算の通知が数時間遅れて届くことがあるため。止まる時点ではクレジットがまだ少し残る。
3,000 円は $20 を 1ドル150円で換算した目安。実際のクレジット額（円）はコンソールの［お支払い］→［クレジット］で見て、違えば予算額を直す。

## AI だけ止まったら

- アプリは動く。Gemini を使う機能（スクショの読み取り、YouTube から見たあなた、URL・視聴履歴の分類、友だちのおすすめの話題の判定）だけが休む
- 再開するときは、何にお金がかかったかを確かめてから、Firestore の `config/ai` を消すか `disabled: false` にする（アプリは1分以内に読み直す）

## 課金まで止まったら

- Cloud Run・Vertex AI（Gemini）・Firestore など有料のサービスはすべて使えなくなる。デプロイした URL も開けなくなる
- 止まったかどうか：`gcloud billing projects describe kurohanpen-devfest26` の `billingEnabled` が `false`
- 再開する前に、何にお金がかかったかをコンソールの［お支払い］→［レポート］で確かめる
- 再開するとカードに請求されるようになる。2人で相談してから：

```
gcloud billing projects link kurohanpen-devfest26 --billing-account=<請求先アカウントの ID>
```

## 気をつけること

- 11/14（Regional Day）までデプロイした URL を動かし続ける必要がある。止まると審査で触ってもらえないので、費用は毎日見る
- 課金を外すと、データが消える場合がある（Google の説明では、課金が無効なまま一定期間たつとリソースが削除されることがある）。止まったら早めに対応する
- 予算の額や割合を変えたら、このファイルも直す

## デプロイ（変更したとき）

```
gcloud functions deploy billing-guard --gen2 --region=asia-northeast1 --runtime=python312 --source=ops/billing-guard --entry-point=stop_billing --trigger-topic=budget-alerts --service-account=billing-guard@kurohanpen-devfest26.iam.gserviceaccount.com --trigger-service-account=billing-guard@kurohanpen-devfest26.iam.gserviceaccount.com --set-env-vars=TARGET_PROJECT_ID=kurohanpen-devfest26,AI_STOP_RATIO=0.7,STOP_RATIO=0.9 --max-instances=1 --memory=256Mi --project=kurohanpen-devfest26
```
