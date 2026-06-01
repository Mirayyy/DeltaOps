import { FIREBASE_PROJECT_ID, FIREBASE_API_KEY } from "../config.js";

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/**
 * Конвертирует JS-значение в формат Firestore REST API.
 * Firestore требует типизированных полей: { stringValue: "..." }, { integerValue: "123" } и т.д.
 */
function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue)
      }
    };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: toFirestoreFields(value)
      }
    };
  }
  return { stringValue: String(value) };
}

/**
 * Конвертирует plain JS-объект в Firestore fields формат.
 */
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

/**
 * Конвертирует Firestore value обратно в JS-значение.
 */
function fromFirestoreValue(val) {
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return val.doubleValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("nullValue" in val) return null;
  if ("arrayValue" in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in val) return fromFirestoreFields(val.mapValue.fields || {});
  return null;
}

/**
 * Конвертирует Firestore fields объект в plain JS-объект.
 */
function fromFirestoreFields(fields) {
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    obj[key] = fromFirestoreValue(val);
  }
  return obj;
}

/**
 * Читает документ из Firestore. Возвращает null если не найден.
 * @param {string} documentPath — например "nicknameIndex/HardKil" или "players/p-1748350001234"
 * @returns {Promise<Object|null>}
 */
export async function readDocument(documentPath) {
  const url = `${BASE_URL}/${documentPath}?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url);

  if (response.status === 404) return null;

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Firestore error: ${response.status}`);
  }

  const doc = await response.json();
  return doc.fields ? fromFirestoreFields(doc.fields) : null;
}

/**
 * Перезаписывает документ целиком (PATCH = setDoc).
 * @param {Object} data — plain JS-объект
 * @param {string} documentPath — путь, например "missions/friday_1"
 */
export async function writeDocument(data, documentPath) {
  const url = `${BASE_URL}/${documentPath}?key=${FIREBASE_API_KEY}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Firestore error: ${response.status}`);
  }

  return response.json();
}

/**
 * Удаляет документ из Firestore.
 * @param {string} documentPath — путь, например "missions/friday_1"
 * @returns {Promise<boolean>}
 */
export async function deleteDocument(documentPath) {
  const url = `${BASE_URL}/${documentPath}?key=${FIREBASE_API_KEY}`;

  const response = await fetch(url, {
    method: "DELETE"
  });

  if (response.status === 404) return false;

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Firestore error: ${response.status}`);
  }

  return true;
}

/**
 * Обновляет только указанные поля документа (PATCH + updateMask).
 * Не затирает поля, которых нет в data.
 * @param {Object} data — только те поля, которые нужно обновить
 * @param {string} documentPath — например "players/p-1748350001234" или "config/squad"
 */
export async function updateFields(data, documentPath) {
  const fieldPaths = Object.keys(data)
    .map(f => `updateMask.fieldPaths=${f}`)
    .join("&");

  const url = `${BASE_URL}/${documentPath}?key=${FIREBASE_API_KEY}&${fieldPaths}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Firestore error: ${response.status}`);
  }

  return response.json();
}
