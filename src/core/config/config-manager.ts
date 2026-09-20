import yaml from "js-yaml";
import fs from "node:fs";
import path from "node:path";

import { AiProvider, DEFAULT_CONFIG, Framework, FRAMEWORK_PRESETS, I18N_LIBRARY_CONFIGS, I18nizerConfig, I18nLibrary } from "../../types/config.js";

const CONFIG_FILE_NAME = "i18nizer.config.yml";
const PROJECT_DIR_NAME = ".i18nizer";

const VALID_AI_PROVIDERS: AiProvider[] = ["openai", "gemini", "huggingface"];

/**
 * Detect project type by looking for framework-specific files
 */
export function detectFramework(cwd: string): Framework {
  const packageJsonPath = path.join(cwd, "package.json");
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.next) {
        return "nextjs";
      }
      
      if (deps.react) {
        return "react";
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  return "react"; // Default fallback
}

/**
 * Detect i18n library from package.json dependencies
 */
export function detectI18nLibrary(cwd: string): I18nLibrary | null {
  const packageJsonPath = path.join(cwd, "package.json");
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check in order of specificity
      if (deps["@inlang/paraglide-js"]) {
        return "paraglide-js";
      }

      if (deps["next-intl"]) {
        return "next-intl";
      }
      
      if (deps["react-i18next"]) {
        return "react-i18next";
      }
      
      if (deps.i18next) {
        return "i18next";
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  return null; // No i18n library detected
}

/**
 * Validate AI provider value
 */
export function validateAiProvider(provider: string): provider is AiProvider {
  return VALID_AI_PROVIDERS.includes(provider as AiProvider);
}

/**
 * Load configuration from the project root
 */
export function loadConfig(cwd: string): I18nizerConfig | null {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  try {
    const fileContent = fs.readFileSync(configPath, "utf8");
    const parsed = yaml.load(fileContent, { schema: yaml.CORE_SCHEMA }) as Partial<I18nizerConfig>;
    
    // Validate AI provider if specified
    if (parsed.ai?.provider && !validateAiProvider(parsed.ai.provider)) {
      throw new Error(
        `Invalid AI provider: ${parsed.ai.provider}. Valid options: ${VALID_AI_PROVIDERS.join(", ")}`
      );
    }
    
    // Deep merge with defaults
    return mergeConfig(DEFAULT_CONFIG, parsed);
  } catch (error) {
    throw new Error(`Failed to parse config file: ${(error as Error).message}`);
  }
}

/**
 * Deep merge configuration objects
 */
function mergeConfig(base: I18nizerConfig, override: Partial<I18nizerConfig>): I18nizerConfig {
  return {
    ai: override.ai ? {
      ...base.ai,
      ...override.ai,
    } : base.ai,
    behavior: {
      ...base.behavior,
      ...override.behavior,
    },
    framework: override.framework ?? base.framework,
    i18n: {
      ...base.i18n,
      ...override.i18n,
      import: {
        ...base.i18n.import,
        ...override.i18n?.import,
      },
    },
    i18nLibrary: override.i18nLibrary ?? base.i18nLibrary,
    messages: {
      ...base.messages,
      ...override.messages,
    },
    paths: override.paths ? {
      ...base.paths,
      ...override.paths,
    } : base.paths,
  };
}

/**
 * Generate config based on framework preset and optional i18n library
 */
export function generateConfig(framework: Framework, i18nLibrary?: I18nLibrary): I18nizerConfig {
  const frameworkPreset = FRAMEWORK_PRESETS[framework];
  
  // Start with defaults merged with framework preset
  const baseConfig = mergeConfig(DEFAULT_CONFIG, frameworkPreset);
  
  // Set autoInjectT based on framework (disabled for Next.js by default)
  if (framework === "nextjs") {
    baseConfig.behavior.autoInjectT = false;
  }
  
  // If i18n library is specified, apply it after framework preset
  // Framework settings take precedence for non-i18n specific fields
  if (i18nLibrary) {
    const i18nConfig = I18N_LIBRARY_CONFIGS[i18nLibrary];
    return mergeConfig(baseConfig, i18nConfig);
  }
  
  return baseConfig;
}

/**
 * Write config to file
 */
export function writeConfig(cwd: string, config: I18nizerConfig): void {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  const yamlContent = yaml.dump(config, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
  });
  
  fs.writeFileSync(configPath, yamlContent, "utf8");
}

/**
 * Get or create project directory (.i18nizer)
 */
export function getProjectDir(cwd: string): string {
  const projectDir = path.join(cwd, PROJECT_DIR_NAME);
  
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  
  return projectDir;
}

/**
 * Get messages directory based on config
 */
export function getMessagesDir(cwd: string, config: I18nizerConfig): string {
  const messagesDir = path.resolve(cwd, config.messages.path);
  
  if (!fs.existsSync(messagesDir)) {
    fs.mkdirSync(messagesDir, { recursive: true });
  }
  
  return messagesDir;
}

/**
 * Check if project is initialized (has config file)
 */
export function isProjectInitialized(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, CONFIG_FILE_NAME));
}

/**
 * Normalize i18n library value (converts "custom" to undefined)
 */
export function normalizeI18nLibrary(library: I18nLibrary | string | undefined): I18nLibrary | undefined {
  if (library === "custom" || !library) {
    return undefined;
  }

  return library as I18nLibrary;
}
