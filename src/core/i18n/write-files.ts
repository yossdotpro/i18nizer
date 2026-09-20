import chalk from "chalk";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { MessagesFormat } from "../../types/config.js";
import { componentNameToFilename } from "./filename-utils.js";
import {
    formatMessageKey,
    INLANG_MESSAGE_FORMAT_SCHEMA_URL,
} from "./output-format.js";

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".i18nizer", "messages");

export interface WriteLocaleFilesOptions {
    format?: MessagesFormat;
}

export function writeLocaleFiles(
    namespace: string,
    data: Record<string, Record<string, Record<string, string>>>,
    locales: string[],
    outputDir?: string,
    options: WriteLocaleFilesOptions = {}
) {
    const baseDir = outputDir ?? DEFAULT_CONFIG_DIR;
    const format = options.format ?? "json";

    if (format === "inlang-message-format") {
        writeInlangMessageFormatFiles(namespace, data, locales, baseDir);
        return;
    }

    writeNamespacedJsonFiles(namespace, data, locales, baseDir);
}

function writeNamespacedJsonFiles(
    namespace: string,
    data: Record<string, Record<string, Record<string, string>>>,
    locales: string[],
    baseDir: string
) {
    const filename = componentNameToFilename(namespace);

    for (const locale of locales) {
        const content: Record<string, Record<string, string>> = {};
        content[namespace] = {};

        // Sort keys for stable output
        const sortedKeys = Object.keys(data[namespace]).sort();

        for (const key of sortedKeys) {
            content[namespace][key] = data[namespace][key][locale];
        }

        const dir = path.join(baseDir, locale);
        fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, `${filename}.json`);
        
        // Use 2-space indentation for clean, readable JSON
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n");

        console.log(chalk.green(`💾 Locale file saved: ${filePath}`));
    }
}

function writeInlangMessageFormatFiles(
    namespace: string,
    data: Record<string, Record<string, Record<string, string>>>,
    locales: string[],
    baseDir: string
) {
    const sortedKeys = Object.keys(data[namespace]).sort();

    fs.mkdirSync(baseDir, { recursive: true });

    for (const locale of locales) {
        const filePath = path.join(baseDir, `${locale}.json`);
        const existingContent = readInlangMessageFile(filePath);

        for (const key of sortedKeys) {
            const value = data[namespace][key][locale];
            if (typeof value !== "undefined") {
                existingContent[formatMessageKey(key, "inlang-message-format")] = value;
            }
        }

        const content: Record<string, string> = {
            $schema: INLANG_MESSAGE_FORMAT_SCHEMA_URL,
        };

        for (const key of Object.keys(existingContent).sort()) {
            content[key] = existingContent[key];
        }

        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n");
        console.log(chalk.green(`💾 Locale file saved: ${filePath}`));
    }
}

function readInlangMessageFile(filePath: string): Record<string, string> {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, string>;
        const content = { ...parsed };
        delete content.$schema;
        return content;
    } catch {
        return {};
    }
}
