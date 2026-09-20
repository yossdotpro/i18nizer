import { Args, Command, Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ora from "ora";

import { generateTranslations, Provider } from "../core/ai/client.js";
import { buildPrompt } from "../core/ai/promt.js";
import { extractTexts } from "../core/ast/extract-text.js";
import { insertUseTranslations } from "../core/ast/insert-user-translations.js";
import { parseFile } from "../core/ast/parse-file.js";
import { replaceTempKeysWithT } from "../core/ast/replace-text-with-text.js";
import { TranslationCache } from "../core/cache/translation-cache.js";
import {
  detectFramework,
  generateConfig,
  getMessagesDir,
  getProjectDir,
  isProjectInitialized,
  loadConfig,
} from "../core/config/config-manager.js";
import { Deduplicator } from "../core/deduplication/deduplicator.js";
import { generateAggregator } from "../core/i18n/generate-aggregator.js";
import { resolveFlatMessageKeyCollisions } from "../core/i18n/flat-message-keys.js";
import { formatMessageKey } from "../core/i18n/output-format.js";
import { parseAiJson } from "../core/i18n/parse-ai-json.js";
import { saveSourceFile } from "../core/i18n/sace-source-file.js";
import { writeLocaleFiles } from "../core/i18n/write-files.js";
import { findProjectComponents } from "../core/scanner/file-scanner.js";
import { I18nizerConfig } from "../types/config.js";

const VALID_PROVIDERS: Provider[] = ["gemini", "huggingface", "openai"];

export default class Translate extends Command {
  static override args = {
    file: Args.string({
      description: "Path to a specific TSX/JSX file (optional, use --all for project-level)",
    }),
  };
  static override description =
    "🌍 Extract and translate strings from components (project-level or standalone)";
  static override flags = {
    all: Flags.boolean({
      char: "a",
      default: false,
      description: "Translate all components in the project",
    }),
    "dry-run": Flags.boolean({
      char: "d",
      default: false,
      description: "Preview changes without writing files",
    }),
    locales: Flags.string({
      char: "l",
      description: "Locales to generate (comma-separated, e.g., en,es,fr)",
    }),
    provider: Flags.string({
      char: "p",
      description: "AI provider (gemini | huggingface | openai)",
    }),
    "show-json": Flags.boolean({
      char: "j",
      default: false,
      description: "Display generated translation JSON output",
    }),
  };

  // eslint-disable-next-line complexity
  async run() {
    const { args, flags } = await this.parse(Translate);
    const cwd = process.cwd();

    // Validate input
    if (!flags.all && !args.file) {
      this.error(
        "❌ Please specify a file or use --all to translate all components"
      );
    }

    if (flags.all && args.file) {
      this.error("❌ Cannot specify both --all and a file path");
    }

    // Load or generate config
    let config: I18nizerConfig;
    const isInitialized = isProjectInitialized(cwd);

    if (isInitialized) {
      config = loadConfig(cwd)!;
      this.log(chalk.cyan("📋 Using project configuration"));
    } else {
      // Standalone mode: use defaults
      const framework = detectFramework(cwd);
      config = generateConfig(framework);
      this.log(
        chalk.yellow("⚠️  Project not initialized, using defaults")
      );
      this.log(
        chalk.cyan("💡 Run"),
        chalk.bold("i18nizer start"),
        chalk.cyan("to initialize the project")
      );
    }

    // Override config with flags if provided
    const locales = flags.locales
      ? flags.locales.split(",")
      : config.messages.locales || [config.messages.defaultLocale, "es"]; // Use config locales or default fallback

    // Use provider from config or flag (flag takes precedence)
    let provider: Provider = config.ai?.provider || "huggingface";
    if (flags.provider) {
      const p = flags.provider.toLowerCase();
      if (!VALID_PROVIDERS.includes(p as Provider)) {
        this.error(
          `❌ Invalid provider: ${flags.provider}. Valid options: ${VALID_PROVIDERS.join(", ")}`
        );
      }

      provider = p as Provider;
    }

    // Use model from config (can be undefined if not specified)
    const aiModel = config.ai?.model;

    // Get files to process
    const filesToProcess: string[] = flags.all
      ? findProjectComponents(cwd)
      : [path.resolve(cwd, args.file!)];

    if (filesToProcess.length === 0) {
      this.log(chalk.yellow("⚠️  No component files found"));
      return;
    }

    this.log(
      chalk.cyan("📂 Files to process:"),
      chalk.bold(filesToProcess.length)
    );
    this.log(chalk.cyan("🌐 Locales:"), locales.join(", "));
    this.log(
      chalk.cyan("🤖 Provider:"),
      flags["dry-run"] ? "deterministic" : provider
    );

    if (flags["dry-run"]) {
      this.log(chalk.yellow("\n🔍 DRY RUN MODE - No files will be modified\n"));
    }

    // Initialize cache and deduplicator
    const tempProjectDir = flags["dry-run"]
      ? fs.mkdtempSync(path.join(os.tmpdir(), "i18nizer-dry-run-"))
      : undefined;
    const projectDir = tempProjectDir ?? getProjectDir(cwd);
    const cache = new TranslationCache(projectDir);
    const deduplicator = new Deduplicator(
      cache,
      !flags["dry-run"] && config.behavior.useAiForKeys,
      provider
    );

    let totalExtracted = 0;
    let totalReused = 0;
    let totalCached = 0;

    try {
      // Process each file sequentially
      for (const filePath of filesToProcess) {
        const componentName = path.basename(filePath).replace(/\.(tsx|jsx)$/, "");
        const spinner = ora(`Processing ${componentName}...`).start();

        try {
          // Parse and extract
          const sourceFile = parseFile(filePath);
          const texts = extractTexts(sourceFile, {
            allowedFunctions: config.behavior.allowedFunctions,
            allowedMemberFunctions: config.behavior.allowedMemberFunctions,
            allowedProps: config.behavior.allowedProps,
          });

          if (texts.length === 0) {
            spinner.info(`⏭️  ${componentName}: No translatable texts found`);
            continue;
          }

          totalExtracted += texts.length;

          // Deduplicate and assign keys using batch processing
          const textList = texts.map((t) => t.text);
          
          // eslint-disable-next-line no-await-in-loop
          const deduplicationResults = await deduplicator.deduplicateBatch(
            textList,
            componentName,
            config.behavior.detectDuplicates
          );

          // Map results back to texts
          const mappedTexts = texts.map((t) => {
            const result = deduplicationResults.get(t.text)!;
            const formattedKey = formatMessageKey(result.key, config.messages.format);

            if (result.isReused) totalReused++;
            if (result.isCached) totalCached++;

            return {
              isCached: result.isCached,
              isPlural: t.isPlural,
              isRichText: t.isRichText,
              key: formattedKey,
              node: t.node,
              placeholders: t.placeholders,
              pluralForms: t.pluralForms,
              pluralVariable: t.pluralVariable,
              richTextElements: t.richTextElements,
              sequenceNodes: t.sequenceNodes,
              tempKey: t.tempKey,
              text: t.text,
            };
          });
          const messagesDir = flags["dry-run"] ? null : getMessagesDir(cwd, config);
          const collisionLocale = locales.includes(config.messages.defaultLocale)
            ? config.messages.defaultLocale
            : locales[0];
          const collisionSafeTexts =
            config.messages.format === "inlang-message-format" && messagesDir
              ? resolveFlatMessageKeyCollisions(
                  mappedTexts,
                  componentName,
                  messagesDir,
                  collisionLocale
                )
              : mappedTexts;

          // Build translations JSON
          const i18nJson: Record<string, Record<string, string>> = {};

          for (const mapped of collisionSafeTexts) {
            i18nJson[mapped.key] = {};

            if (mapped.isCached) {
              const cached = cache.get(mapped.text)!;
              for (const locale of locales) {
                i18nJson[mapped.key][locale] = cached.locales[locale] ?? mapped.text;
              }
            } else if (mapped.isPlural && mapped.pluralForms) {
              for (const locale of locales) {
                const icuFormat = `{${mapped.pluralVariable}, plural, one {${mapped.pluralForms.one}} other {${mapped.pluralForms.other}}}`;
                i18nJson[mapped.key][locale] = icuFormat;
              }
            } else if (flags["dry-run"]) {
              for (const locale of locales) {
                i18nJson[mapped.key][locale] = mapped.text;
              }
            } else {
              for (const locale of locales) {
                i18nJson[mapped.key][locale] = "";
              }
            }
          }

          const textsNeedingTranslation = flags["dry-run"]
            ? []
            : collisionSafeTexts.filter((t) => !t.isCached && !t.isPlural);

          if (textsNeedingTranslation.length > 0) {
            spinner.text = `${componentName}: Generating translations with ${provider}...`;

            const prompt = buildPrompt({
              componentName,
              locales,
              texts: textsNeedingTranslation.map((t) => ({
                tempKey: t.tempKey,
                text: t.text,
              })),
            });

            // eslint-disable-next-line no-await-in-loop
            const raw = await generateTranslations(prompt, provider, aiModel);
            if (!raw) throw new Error("AI did not return any data");

            const aiJson = parseAiJson(raw);
            const namespace = aiJson[componentName] as Record<
              string,
              Record<string, string>
            >;

            for (const mapped of textsNeedingTranslation) {
              const aiTranslations = namespace[mapped.tempKey];
              if (!aiTranslations) {
                continue;
              }

              for (const locale of locales) {
                i18nJson[mapped.key][locale] = aiTranslations[locale] ?? mapped.text;
              }

              cache.set({
                componentName,
                key: mapped.key,
                locales: i18nJson[mapped.key],
                text: mapped.text,
              });
            }
          }

          if (flags["show-json"]) {
            this.log("\n" + chalk.cyan(`${componentName} JSON:`));
            this.log(JSON.stringify({ [componentName]: i18nJson }, null, 2));
            this.log("");
          }

          if (!flags["dry-run"]) {
            writeLocaleFiles(
              componentName,
              { [componentName]: i18nJson },
              locales,
              messagesDir!,
              { format: config.messages.format }
            );

            if (config.behavior.autoInjectT) {
              insertUseTranslations(sourceFile, componentName, {
                i18nLibrary: config.i18nLibrary,
                import: config.i18n.import,
              });
            }
            
            replaceTempKeysWithT(
              collisionSafeTexts.map((m) => ({
                sequenceNodes: m.sequenceNodes,
                isPlural: m.isPlural,
                isRichText: m.isRichText,
                key: m.key,
                node: m.node,
                placeholders: m.placeholders,
                richTextElements: m.richTextElements,
                tempKey: m.tempKey,
              })),
              {
                allowedFunctions: config.behavior.allowedFunctions,
                allowedMemberFunctions: config.behavior.allowedMemberFunctions,
                allowedProps: config.behavior.allowedProps,
                i18nLibrary: config.i18nLibrary,
              }
            );
            saveSourceFile(sourceFile);
          }

          spinner.succeed(
            `✅ ${componentName}: ${texts.length} strings (${totalReused} reused, ${totalCached} cached)`
          );
        } catch (error: unknown) {
          spinner.fail(`❌ ${componentName}: Failed`);
          if (error instanceof Error) {
            this.error(error.message);
          }
        }
      }

      if (!flags["dry-run"]) {
        cache.save();

        if (isInitialized && config.messages.format === "json") {
          const messagesDir = getMessagesDir(cwd, config);
          generateAggregator(messagesDir);
        }
      }
    } finally {
      if (tempProjectDir) {
        fs.rmSync(tempProjectDir, { force: true, recursive: true });
      }
    }

    // Get statistics from deduplicator
    const stats = deduplicator.getStats();

    // Summary
    this.log("");
    this.log(chalk.green("🎉 Translation complete!"));
    this.log(chalk.cyan("📊 Summary:"));
    this.log(`  Files processed: ${chalk.bold(filesToProcess.length)}`);
    this.log(`  Strings extracted: ${chalk.bold(totalExtracted)}`);
    this.log(`  Unique strings: ${chalk.bold(stats.uniqueStrings)}`);
    this.log(`  Keys reused: ${chalk.bold(totalReused)}`);
    this.log(`  Cached translations: ${chalk.bold(totalCached)}`);
    this.log(`  AI requests (keys): ${chalk.bold(stats.aiRequestsUsed)}`);
    this.log("");
  }
}
