import { Args, Command, Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ora, { Ora } from "ora";

import { Provider } from "../core/ai/client.js";
import { extractTexts } from "../core/ast/extract-text.js";
import { parseFile } from "../core/ast/parse-file.js";
import { TranslationCache } from "../core/cache/translation-cache.js";
import {
  detectFramework,
  generateConfig,
  getMessagesDir,
  isProjectInitialized,
  loadConfig,
} from "../core/config/config-manager.js";
import { Deduplicator } from "../core/deduplication/deduplicator.js";
import { resolveFlatMessageKeyCollisions } from "../core/i18n/flat-message-keys.js";
import { formatMessageKey } from "../core/i18n/output-format.js";
import { writeLocaleFiles } from "../core/i18n/write-files.js";
import { I18nizerConfig } from "../types/config.js";

const VALID_PROVIDERS: Provider[] = ["gemini", "huggingface", "openai"];

export default class Extract extends Command {
  static override args = {
    file: Args.string({
      description: "Path to the TSX/JSX file",
      required: true,
    }),
  };
  static override description =
    "🌍 Extract translatable strings from a TSX/JSX file and generate i18n JSON";
  static override flags = {
    locales: Flags.string({
      char: "l",
      description: "Locales to generate",
    }),
    provider: Flags.string({
      char: "p",
      description: "AI provider (gemini | huggingface), optional",
    }),
    "use-ai-keys": Flags.boolean({
      allowNo: true,
      default: false,
      description: "Use AI to generate human-readable keys (default: false)",
    }),
    "dry-run": Flags.boolean({
      char: "d",
      default: false,
      description: "Preview extracted messages without writing files",
    }),
  };

  async run() {
    const { args, flags } = await this.parse(Extract);

    this.log(chalk.cyan("📄 File:"), args.file);
    // Load or generate config
    let config: I18nizerConfig;
    const cwd = process.cwd();
    if (isProjectInitialized(cwd)) {
      config = loadConfig(cwd)!;
    } else {
      const framework = detectFramework(cwd);
      config = generateConfig(framework);
    }

    const requestedLocales = flags.locales
      ? flags.locales.split(",")
      : config.messages.locales;
    const outputLocales = [config.messages.defaultLocale];

    this.log(chalk.cyan("🌐 Locales:"), requestedLocales.join(","));

    let provider: Provider = (config.ai?.provider as Provider) || "huggingface";
    if (flags.provider) {
      const p = flags.provider.toLowerCase();
      if (!VALID_PROVIDERS.includes(p as Provider)) {
        this.error(
          `❌ Invalid provider: ${flags.provider}. Valid options: ${VALID_PROVIDERS.join(
            ", "
          )}`
        );
      }

      provider = p as Provider;
    }

    this.log(
      chalk.cyan("🤖 Provider:"),
      flags["use-ai-keys"] ? provider : "deterministic"
    );

    if (flags["dry-run"]) {
      this.log(chalk.yellow("\n🔍 DRY RUN MODE - No files will be modified\n"));
    }

    // Parse file
    const sourceFile = parseFile(args.file);
    const texts = extractTexts(sourceFile, {
      allowedFunctions: config.behavior.allowedFunctions,
      allowedMemberFunctions: config.behavior.allowedMemberFunctions,
      allowedProps: config.behavior.allowedProps,
    });

    if (texts.length === 0) {
      this.log(chalk.yellow("⚠️  No translatable texts found."));
      return;
    }

    const componentName = path
      .basename(args.file)
      .replace(/\.(tsx|jsx)$/, "");

    // Count unique strings
    const uniqueTexts = new Set(texts.map((t) => t.text));

    this.log(
      `🔍 Extracting strings... (${chalk.green(texts.length)} found, ${chalk.green(uniqueTexts.size)} unique)`
    );

    // Initialize cache and deduplicator
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "i18nizer-extract-"));
    const cache = new TranslationCache(projectDir);
    const deduplicator = new Deduplicator(cache, flags["use-ai-keys"], provider);

    let keySpinner: Ora | undefined;
    if (flags["use-ai-keys"]) {
      keySpinner = ora("🧠 Generating keys (batch)...").start();
    } else {
      this.log("🔑 Generating keys (deterministic)...");
    }

    try {
      const textList = texts.map((t) => t.text);
      const deduplicationResults = await deduplicator.deduplicateBatch(
        textList,
        componentName,
        config.behavior.detectDuplicates
      );

      const stats = deduplicator.getStats();

      if (keySpinner) {
        keySpinner.succeed(
          `🧠 Generated ${chalk.green(uniqueTexts.size)} keys`
        );
      } else {
        this.log(`✅ Generated ${chalk.green(uniqueTexts.size)} keys (deterministic)`);
      }
      
      this.log(`💾 Cache hits: ${chalk.green(stats.cacheHits)}`);
      this.log(`🤖 AI requests used: ${chalk.green(stats.aiRequestsUsed)}`);

      const mappedTexts = texts.map((t) => {
        const result = deduplicationResults.get(t.text)!;
        return {
          isPlural: t.isPlural,
          key: formatMessageKey(result.key, config.messages.format),
          placeholders: t.placeholders,
          pluralForms: t.pluralForms,
          pluralVariable: t.pluralVariable,
          sequenceNodes: t.sequenceNodes,
          tempKey: t.tempKey,
          text: t.text,
        };
      });
      const messagesDir = flags["dry-run"] ? null : getMessagesDir(cwd, config);
      const collisionSafeTexts =
        config.messages.format === "inlang-message-format" && messagesDir
          ? resolveFlatMessageKeyCollisions(
              mappedTexts,
              componentName,
              messagesDir,
              config.messages.defaultLocale
            )
          : mappedTexts;

      const i18nJson: Record<string, Record<string, string>> = {};

      for (const mapped of collisionSafeTexts) {
        i18nJson[mapped.key] = {};

        if (mapped.isPlural && mapped.pluralForms) {
          for (const locale of outputLocales) {
            const icuFormat = `{${mapped.pluralVariable}, plural, one {${mapped.pluralForms.one}} other {${mapped.pluralForms.other}}}`;
            i18nJson[mapped.key][locale] = icuFormat;
          }
        } else {
          for (const locale of outputLocales) {
            i18nJson[mapped.key][locale] = mapped.text;
          }
        }
      }

      if (!flags["dry-run"]) {
        writeLocaleFiles(
          componentName,
          { [componentName]: i18nJson },
          outputLocales,
          messagesDir!,
          { format: config.messages.format }
        );
        this.log(chalk.green("🌍 JSON files generated without AI translations"));
      } else {
        this.log(chalk.green("🌍 Extraction preview generated without writing locale files"));
      }
    } catch (error: unknown) {
      if (keySpinner) {
        keySpinner.fail("❌ Failed to generate extraction output");
      }
      if (error instanceof Error) {
        this.error(error.message);
      } else {
        this.error("An unknown error occurred");
      }
    } finally {
      fs.rmSync(projectDir, { force: true, recursive: true });
    }
  }
}
