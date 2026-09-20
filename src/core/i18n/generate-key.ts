/**
 * Generate a deterministic, human-readable translation key from text.
 * This is used as a fallback when AI-generated keys are not available.
 */

/**
 * Convert a string to camelCase
 */
function toCamelCase(str: string): string {
  return str
    .replaceAll(/[^\w\s]/g, " ") // Replace special chars (note: \w includes underscores, so this won't replace them)
    .replaceAll("_", " ") // Explicitly replace underscores with spaces
    .split(/\s+/) // Split by whitespace
    .filter(Boolean) // Remove empty strings
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function hashText(text: string): string {
  let hash = 2_166_136_261;

  for (const character of text) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function containsLettersOrDigits(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

/**
 * Generate a deterministic key from text.
 * 
 * Rules:
 * - Remove special characters
 * - Convert to camelCase
 * - Limit to first 4-5 words for readability
 * - Ensure minimum length
 * 
 * @param text - The text to generate a key from
 * @returns A camelCase key
 */
export function generateKey(text: string): string {
  // Remove template literal placeholders like {name}
  const cleanedText = text.replaceAll(/\{[^}]+\}/g, "");
  
  // Replace apostrophes followed by 's' with just 's' (e.g., "User's" -> "Users")
  const normalizedText = cleanedText
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/'s\b/g, "s");
  
  // Split into words and take first 4-5 significant words
  const words = normalizedText
    .replaceAll(/[^A-Za-z0-9_\s]/g, " ")
    .replaceAll("_", " ") // Explicitly replace underscores with spaces
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  
  if (words.length === 0) {
    if (containsLettersOrDigits(cleanedText)) {
      return `text${hashText(cleanedText)}`;
    }

    return "text";
  }
  
  const key = toCamelCase(words.join(" "));
  
  // Ensure minimum key length
  if (key.length < 3) {
    if (containsLettersOrDigits(cleanedText) && !/[A-Za-z0-9]/.test(cleanedText)) {
      return `text${hashText(cleanedText)}`;
    }

    return "text";
  }
  
  return key;
}

/**
 * Generate a unique key by appending a counter if needed.
 * 
 * @param baseKey - The base key
 * @param existingKeys - Set of already used keys
 * @returns A unique key
 */
export function generateUniqueKey(baseKey: string, existingKeys: Set<string>): string {
  if (!existingKeys.has(baseKey)) {
    return baseKey;
  }
  
  let counter = 2;
  let uniqueKey = `${baseKey}${counter}`;
  
  while (existingKeys.has(uniqueKey)) {
    counter++;
    uniqueKey = `${baseKey}${counter}`;
  }
  
  return uniqueKey;
}
