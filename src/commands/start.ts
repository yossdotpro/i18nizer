import { Command, Flags } from "@oclif/core";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";

import {
  detectFramework,
  detectI18nLibrary,
  generateConfig,
  getMessagesDir,
  getProjectDir,
  isProjectInitialized,
  normalizeI18nLibrary,
  writeConfig,
} from "../core/config/config-manager.js";
import { ensureI18nizerDirInGitignore } from "../core/config/gitignore-manager.js";
import { Framework, I18nLibrary } from "../types/config.js";

export default class Start extends Command {
  static override description =
    "🚀 Initialize i18nizer in your project with framework presets";

  static override flags = {
    force: Flags.boolean({
      char: "f",
      default: false,
      description: "Force re-initialization even if config exists",
    }),
    framework: Flags.string({
      description: "Framework (nextjs, react, custom)",
      options: ["nextjs", "react", "custom"],
    }),
    i18n: Flags.string({
      description: "i18n library (next-intl, react-i18next, i18next, paraglide-js, custom)",
      options: ["next-intl", "react-i18next", "i18next", "paraglide-js", "custom"],
    }),
    preset: Flags.string({
      char: "p",
      deprecated: {
        message: "Use --framework instead",
        version: "0.4.0",
      },
      description: "Framework preset (deprecated, use --framework)",
      options: ["nextjs", "react", "custom"],
    }),
    yes: Flags.boolean({
      char: "y",
      default: false,
      description: "Skip interactive prompts and use detected/default values",
    }),
  };

  async run() {
    const { flags } = await this.parse(Start);
    const cwd = process.cwd();

    // Check if already initialized
    if (isProjectInitialized(cwd) && !flags.force) {
      this.log(chalk.yellow("⚠️  Project is already initialized!"));
      this.log(
        chalk.cyan("💡 Use"),
        chalk.bold("--force"),
        chalk.cyan("to re-initialize")
      );
      return;
    }

    let framework: Framework;
    let i18nLibrary: I18nLibrary | undefined;

    // Handle deprecated --preset flag
    if (flags.preset) {
      framework = flags.preset as Framework;
    } else if (flags.framework) {
      framework = flags.framework as Framework;
    } else {
      // Detect framework and i18n library
      const detectedFramework = detectFramework(cwd);
      const detectedI18n = detectI18nLibrary(cwd);

      if (flags.yes) {
        // Non-interactive mode: use detected values
        framework = detectedFramework;
        i18nLibrary = detectedI18n ?? undefined;
        
        this.log(chalk.cyan("🔍 Auto-detected:"));
        this.log(`  Framework: ${chalk.bold(framework)}`);
        if (i18nLibrary) {
          this.log(`  i18n Library: ${chalk.bold(i18nLibrary)}`);
        }
      } else {
        // Interactive mode: ask user
        const answers = await inquirer.prompt([
          {
            choices: [
              { name: "Next.js", value: "nextjs" },
              { name: "React", value: "react" },
              { name: "Custom", value: "custom" },
            ],
            default: detectedFramework,
            message: "What framework are you using?",
            name: "framework",
            type: "list",
          },
          {
            choices: [
              { name: "next-intl", value: "next-intl" },
              { name: "react-i18next", value: "react-i18next" },
              { name: "i18next", value: "i18next" },
              { name: "paraglide-js", value: "paraglide-js" },
              { name: "Custom / None", value: "custom" },
            ],
            default: detectedI18n ?? "custom",
            message: "Which i18n library are you using?",
            name: "i18nLibrary",
            type: "list",
          },
        ]);

        framework = answers.framework;
        i18nLibrary = normalizeI18nLibrary(answers.i18nLibrary);
      }
    }

    // Override with CLI flag if provided
    if (flags.i18n) {
      i18nLibrary = normalizeI18nLibrary(flags.i18n);
    }

    const spinner = ora("Initializing i18nizer...").start();

    try {
      // Generate config
      spinner.text = "Generating configuration...";
      const config = generateConfig(framework, i18nLibrary);

      // Create project directory
      const projectDir = getProjectDir(cwd);
      spinner.succeed(`✅ Created ${chalk.cyan(".i18nizer/")} directory`);

      // Write config file
      spinner.start("Writing configuration file...");
      writeConfig(cwd, config);
      
      let presetDescription = framework;
      if (i18nLibrary) {
        presetDescription += ` + ${i18nLibrary}`;
      }
      
      spinner.succeed(
        `✅ Created ${chalk.cyan("i18nizer.config.yml")} with ${chalk.bold(presetDescription)} preset`
      );

      // Create messages directory
      spinner.start("Setting up messages directory...");
      const messagesDir = getMessagesDir(cwd, config);
      spinner.succeed(
        `✅ Created ${chalk.cyan(config.messages.path + "/")} directory`
      );

      // Add .i18nizer/ to .gitignore
      spinner.start("Adding .i18nizer/ to .gitignore...");
      const addedToGitignore = ensureI18nizerDirInGitignore(cwd);
      if (addedToGitignore) {
        spinner.succeed(`✅ Added ${chalk.cyan(".i18nizer/")} to .gitignore`);
      } else {
        spinner.info(`ℹ️  ${chalk.cyan(".i18nizer/")} already in .gitignore`);
      }

      // Summary
      this.log("");
      this.log(chalk.green("🎉 i18nizer initialized successfully!"));
      this.log("");
      this.log(chalk.bold("📋 Configuration:"));
      this.log(`  Framework: ${chalk.cyan(config.framework)}`);
      if (config.i18nLibrary) {
        this.log(`  i18n Library: ${chalk.cyan(config.i18nLibrary)}`);
      }
      this.log(`  i18n Function: ${chalk.cyan(config.i18n.function)}`);
      this.log(
        `  Import: ${chalk.cyan(config.i18n.import.named)} from "${chalk.cyan(config.i18n.import.source)}"`
      );
      this.log(`  Messages Path: ${chalk.cyan(config.messages.path)}`);
      this.log(
        `  Default Locale: ${chalk.cyan(config.messages.defaultLocale)}`
      );
      this.log("");
      this.log(chalk.bold("🚀 Next steps:"));
      this.log(
        `  1. Review and customize ${chalk.cyan("i18nizer.config.yml")}`
      );
      this.log(
        `  2. Run ${chalk.cyan("i18nizer translate --all")} to translate all components`
      );
      this.log(
        `  3. Or translate a single file: ${chalk.cyan("i18nizer translate <file>")}`
      );
      this.log("");
    } catch (error: unknown) {
      spinner.fail("❌ Initialization failed");
      if (error instanceof Error) {
        this.error(error.message);
      } else {
        this.error("An unknown error occurred");
      }
    }
  }
}
