import fs from "node:fs";
import path from "node:path";

import { componentNameToFilename } from "./filename-utils.js";
import { formatMessageKey } from "./output-format.js";

function readFlatMessageFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const content = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, string>;
    delete content.$schema;
    return content;
  } catch {
    return {};
  }
}

function reserveCollisionSafeKey(
  baseKey: string,
  namespace: string,
  text: string,
  reservedKeys: Map<string, string>
): string {
  const existingValue = reservedKeys.get(baseKey);
  if (typeof existingValue === "undefined" || existingValue === text) {
    reservedKeys.set(baseKey, text);
    return baseKey;
  }

  const namespacePrefix = formatMessageKey(
    componentNameToFilename(namespace),
    "inlang-message-format"
  );
  const candidateBase = `${namespacePrefix}_${baseKey}`;
  let candidate = candidateBase;
  let counter = 2;

  while (reservedKeys.has(candidate) && reservedKeys.get(candidate) !== text) {
    candidate = `${candidateBase}_${counter++}`;
  }

  reservedKeys.set(candidate, text);
  return candidate;
}

export function resolveFlatMessageKeyCollisions<T extends { key: string; text: string }>(
  entries: T[],
  namespace: string,
  messagesDir: string,
  locale: string
): T[] {
  const filePath = path.join(messagesDir, `${locale}.json`);
  const reservedKeys = new Map(Object.entries(readFlatMessageFile(filePath)));

  return entries.map((entry) => ({
    ...entry,
    key: reserveCollisionSafeKey(entry.key, namespace, entry.text, reservedKeys),
  }));
}
