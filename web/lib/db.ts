import "server-only";
import { FieldValue, Firestore, type DocumentData } from "@google-cloud/firestore";
import type { SavedDiagnosis } from "./compare";
import { isDocId } from "./doc-id";

// サーバーからだけ読み書きする。ブラウザから Firestore には直接つながない
const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "kurohanpen-devfest26",
});

const diagnoses = db.collection("diagnoses");


// 比べる相手として読む最大件数。試作なので全件をサーバーの中で集計する
const MAX_READ = 2000;

// id は本人だけが持つ鍵（自分のまとめを開く）、inviteId は友だちに渡す鍵（型と比較だけに使える）
export async function saveDiagnosisDoc(data: Omit<SavedDiagnosis, "id" | "inviteId">) {
  const inviteId = crypto.randomUUID();
  const ref = await diagnoses.add({ ...data, inviteId, createdAt: new Date() });
  return { id: ref.id, inviteId };
}

export async function getDiagnosisByInvite(inviteId: string): Promise<SavedDiagnosis | null> {
  if (typeof inviteId !== "string" || !inviteId || inviteId.length > 64) return null;
  const snap = await diagnoses.where("inviteId", "==", inviteId).limit(1).get();
  const doc = snap.docs[0];
  return doc ? toDiagnosis(doc.id, doc.data()) : null;
}

export async function getDiagnosisDoc(id: string): Promise<SavedDiagnosis | null> {
  if (!isDocId(id)) return null;
  const snap = await diagnoses.doc(id).get();
  if (!snap.exists) return null;
  return toDiagnosis(snap.id, snap.data()!);
}

export async function listDiagnosisDocs(): Promise<SavedDiagnosis[]> {
  const snap = await diagnoses.orderBy("createdAt", "desc").limit(MAX_READ).get();
  return snap.docs.map((d) => toDiagnosis(d.id, d.data()));
}

// Gemini が作った「型・島のホーム画面のイメージ」を保存しておき、2回目からはすぐ返す
const feeds = db.collection("feeds");

export async function getFeedDoc<T>(key: string): Promise<T[] | null> {
  const snap = await feeds.doc(key).get();
  return snap.exists ? ((snap.data()!.videos as T[]) ?? null) : null;
}

export async function saveFeedDoc<T>(key: string, videos: T[]) {
  await feeds.doc(key).set({ videos, createdAt: new Date() });
}

const groups = db.collection("groups");

export async function createGroupDoc(name: string) {
  const ref = await groups.add({ name, createdAt: new Date() });
  return ref.id;
}

export async function getGroupDoc(id: string) {
  if (!isDocId(id)) return null;
  const snap = await groups.doc(id).get();
  return snap.exists ? { id: snap.id, name: (snap.data()!.name as string) ?? "" } : null;
}

export async function listGroupMembers(groupId: string) {
  const snap = await diagnoses.where("groupId", "==", groupId).limit(200).get();
  return snap.docs.map((d) => toDiagnosis(d.id, d.data()));
}

function toDiagnosis(id: string, d: DocumentData): SavedDiagnosis {
  return {
    id,
    counts: d.counts ?? {},
    topicCounts: d.topicCounts,
    total: d.total ?? 0,
    type: d.type ?? "",
    ageBand: d.ageBand,
    region: d.region,
    channels: d.channels,
    groupId: d.groupId,
    inviteId: d.inviteId,
    sample: d.sample === true,
  };
}

// 灯しバトン：友だちが、その人の霧の中にある動画を1本渡す。見ると、その島に渡した人の名前で灯りがつく。
// toId は受け取る人の本人用の id（画面には返さない）。渡す人は招待用の id から受け取る人を引く
const batons = db.collection("batons");
const MAX_BATONS = 50;

export type Baton = {
  id: string;
  topic: string;
  url: string;
  title: string;
  channel?: string;
  from: string;
  message?: string;
  createdAt: string;
  litAt?: string;
};

function toBaton(id: string, d: DocumentData): Baton {
  return {
    id,
    topic: d.topic,
    url: d.url,
    title: d.title,
    channel: d.channel,
    from: d.from,
    message: d.message,
    createdAt: (d.createdAt?.toDate?.() ?? new Date()).toISOString(),
    litAt: d.litAt?.toDate?.().toISOString(),
  };
}

export async function listBatons(toId: string): Promise<Baton[]> {
  const snap = await batons.where("toId", "==", toId).limit(MAX_BATONS).get();
  return snap.docs.map((d) => toBaton(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addBaton(toId: string, b: Omit<Baton, "id" | "createdAt" | "litAt">) {
  const count = (await batons.where("toId", "==", toId).limit(MAX_BATONS).get()).size;
  if (count >= MAX_BATONS) return null;
  const ref = await batons.add({ ...b, toId, createdAt: new Date() });
  return ref.id;
}

// 本人が「見た」を押したときだけ灯す。本人用の id と合わないものは灯さない
export async function lightBaton(toId: string, batonId: string) {
  if (!isDocId(batonId)) return false;
  const ref = batons.doc(batonId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.toId !== toId) return false;
  if (!snap.data()!.litAt) await ref.update({ litAt: new Date() });
  return true;
}

// Gemini を呼んだ回数を、日本時間の1日ごとに数える（1日の上限を超えたら AI を休ませるため）
const usage = db.collection("usage");

export async function countAiCall() {
  const day = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ref = usage.doc(day);
  await ref.set({ gemini: FieldValue.increment(1) }, { merge: true });
  return ((await ref.get()).data()?.gemini as number | undefined) ?? 0;
}

// 予算の安全装置（ops/billing-guard）が、使いすぎのときに立てる「AI を止める」印
export async function aiDisabledFlag() {
  const snap = await db.collection("config").doc("ai").get();
  return snap.exists && snap.data()!.disabled === true;
}
