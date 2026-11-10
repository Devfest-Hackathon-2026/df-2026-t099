// Firestore が自動で作る文書 ID の形（英数字20文字）。外から来た id はこの形のときだけ使う
// （"/" を含む id で別の場所を読ませたり、変な値でエラーを起こさせたりしないため）
const DOC_ID = /^[A-Za-z0-9]{20}$/;
export const isDocId = (id: unknown): id is string => typeof id === "string" && DOC_ID.test(id);
