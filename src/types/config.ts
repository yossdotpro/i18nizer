/**
 * Configuration types for i18nizer
 */

export type Framework = "custom" | "nextjs" | "react";
export type I18nLibrary =
  | "custom"
  | "i18next"
  | "next-intl"
  | "paraglide-js"
  | "react-i18next";
export type AiProvider = "gemini" | "huggingface" | "openai";
export type MessagesFormat = "inlang-message-format" | "json";

export interface I18nizerConfig {
  ai?: {
    model: string;
    provider: AiProvider;
  };
  behavior: {
    allowedFunctions: string[];
    allowedMemberFunctions: string[];
    allowedProps: string[];
    autoInjectT: boolean;
    detectDuplicates: boolean;
    opinionatedStructure: boolean;
    useAiForKeys: boolean;
  };
  framework: Framework;
  i18n: {
    function: string;
    import: {
      named: string;
      source: string;
    };
  };
  i18nLibrary?: I18nLibrary; // Optional field to track detected library
  messages: {
    defaultLocale: string;
    format: MessagesFormat;
    locales: string[];
    path: string;
  };
  paths?: {
    i18n: string;
    src: string;
  };
}

export const DEFAULT_CONFIG: I18nizerConfig = {
  ai: {
    model: "gpt-4",
    provider: "openai",
  },
  behavior: {
    allowedFunctions: ["alert", "confirm", "prompt"],
    allowedMemberFunctions: ["toast.error", "toast.info", "toast.success", "toast.warn"],
    allowedProps: [
      "alt",
      "aria-label",
      "aria-placeholder",
      "helperText",
      "label",
      "placeholder",
      "text",
      "title",
      "tooltip",
    ],
    autoInjectT: true, // Default enabled for React
    detectDuplicates: true,
    opinionatedStructure: true,
    useAiForKeys: true, // Use AI to generate English keys
  },
  framework: "react",
  i18n: {
    function: "t",
    import: {
      named: "useTranslations",
      source: "next-intl",
    },
  },
  messages: {
    defaultLocale: "en",
    format: "json",
    locales: ["en", "es"],
    path: "messages",
  },
  paths: {
    i18n: "i18n",
    src: "src",
  },
};

export const FRAMEWORK_PRESETS: Record<Framework, Partial<I18nizerConfig>> = {
  custom: {},
  nextjs: {
    framework: "nextjs",
    i18n: {
      function: "t",
      import: {
        named: "useTranslations",
        source: "next-intl",
      },
    },
    i18nLibrary: "next-intl",
  },
  react: {
    framework: "react",
    i18n: {
      function: "t",
      import: {
        named: "useTranslation",
        source: "react-i18next",
      },
    },
    i18nLibrary: "react-i18next",
  },
};

/**
 * I18n library-specific configurations
 */
export const I18N_LIBRARY_CONFIGS: Record<I18nLibrary, Partial<I18nizerConfig>> = {
  custom: {
    i18n: {
      function: "t",
      import: {
        named: "useTranslations",
        source: "next-intl",
      },
    },
    i18nLibrary: "custom",
  },
  "i18next": {
    i18n: {
      function: "t",
      import: {
        named: "useTranslation",
        source: "react-i18next", // Default to react-i18next for React apps
      },
    },
    i18nLibrary: "i18next",
  },
  "next-intl": {
    i18n: {
      function: "t",
      import: {
        named: "useTranslations",
        source: "next-intl",
      },
    },
    i18nLibrary: "next-intl",
  },
  "react-i18next": {
    i18n: {
      function: "t",
      import: {
        named: "useTranslation",
        source: "react-i18next",
      },
    },
    i18nLibrary: "react-i18next",
  },
  "paraglide-js": {
    i18n: {
      function: "m",
      import: {
        named: "m",
        source: "./paraglide/messages.js",
      },
    },
    i18nLibrary: "paraglide-js",
    messages: {
      defaultLocale: "en",
      format: "inlang-message-format",
      locales: ["en", "es"],
      path: "messages",
    },
  },
};
