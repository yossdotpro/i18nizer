import { expect } from 'chai';
import yaml from 'js-yaml';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  detectFramework,
  detectI18nLibrary,
  generateConfig,
  getMessagesDir,
  getProjectDir,
  isProjectInitialized,
  loadConfig,
  writeConfig,
} from '../../../src/core/config/config-manager.js';
import { AiProvider, Framework } from '../../../src/types/config.js';

describe('Config Manager', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `i18nizer-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { force: true, recursive: true });
    }
  });

  describe('detectFramework', () => {
    it('should detect Next.js from package.json', () => {
      const packageJson = {
        dependencies: {
          next: '^14.0.0',
          'next-intl': '^3.0.0',
          react: '^18.0.0',
        },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const framework = detectFramework(testDir);
      expect(framework).to.equal('nextjs');
    });

    it('should detect React from package.json', () => {
      const packageJson = {
        dependencies: {
          react: '^18.0.0',
          'react-i18next': '^12.0.0',
        },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const framework = detectFramework(testDir);
      expect(framework).to.equal('react');
    });

    it('should default to React if no package.json', () => {
      const framework = detectFramework(testDir);
      expect(framework).to.equal('react');
    });
  });

  describe('detectI18nLibrary', () => {
    it('should detect Paraglide JS from package.json', () => {
      const packageJson = {
        dependencies: {
          '@inlang/paraglide-js': '^2.0.0',
          react: '^18.0.0',
        },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson)
      );

      const i18nLibrary = detectI18nLibrary(testDir);
      expect(i18nLibrary).to.equal('paraglide-js');
    });
  });

  describe('generateConfig', () => {
    it('should generate Next.js config', () => {
      const config = generateConfig('nextjs');
      expect(config.framework).to.equal('nextjs');
      expect(config.i18n.import.source).to.equal('next-intl');
      expect(config.i18n.import.named).to.equal('useTranslations');
    });

    it('should generate React config', () => {
      const config = generateConfig('react');
      expect(config.framework).to.equal('react');
      expect(config.i18n.import.source).to.equal('react-i18next');
      expect(config.i18n.import.named).to.equal('useTranslation');
    });

    it('should include default behavior settings', () => {
      const config = generateConfig('react');
      expect(config.behavior.detectDuplicates).to.be.true;
      expect(config.behavior.opinionatedStructure).to.be.true;
      expect(config.behavior.allowedFunctions).to.include('alert');
      expect(config.behavior.allowedProps).to.include('placeholder');
    });

    it('should generate Paraglide JS config', () => {
      const config = generateConfig('react', 'paraglide-js' as never);
      expect(config.i18nLibrary).to.equal('paraglide-js');
      expect(config.i18n.function).to.equal('m');
      expect(config.i18n.import.named).to.equal('m');
      expect(config.i18n.import.source).to.equal('./paraglide/messages.js');
      expect(config.messages.path).to.equal('messages');
    });
  });

  describe('writeConfig and loadConfig', () => {
    it('should write and load config correctly', () => {
      const config = generateConfig('nextjs');
      writeConfig(testDir, config);

      const loadedConfig = loadConfig(testDir);
      expect(loadedConfig).to.not.be.null;
      expect(loadedConfig!.framework).to.equal('nextjs');
      expect(loadedConfig!.i18n.function).to.equal('t');
    });

    it('should return null if config does not exist', () => {
      const loadedConfig = loadConfig(testDir);
      expect(loadedConfig).to.be.null;
    });

    it('should write valid YAML', () => {
      const config = generateConfig('react');
      writeConfig(testDir, config);

      const configPath = path.join(testDir, 'i18nizer.config.yml');
      const content = fs.readFileSync(configPath, 'utf8');
      
      expect(content).to.include('framework: react');
      expect(content).to.include('function: t');
      expect(content).to.include('detectDuplicates: true');
    });
  });

  describe('isProjectInitialized', () => {
    it('should return false if config does not exist', () => {
      expect(isProjectInitialized(testDir)).to.be.false;
    });

    it('should return true if config exists', () => {
      const config = generateConfig('react');
      writeConfig(testDir, config);
      expect(isProjectInitialized(testDir)).to.be.true;
    });
  });

  describe('getProjectDir', () => {
    it('should create .i18nizer directory if it does not exist', () => {
      const projectDir = getProjectDir(testDir);
      expect(fs.existsSync(projectDir)).to.be.true;
      expect(path.basename(projectDir)).to.equal('.i18nizer');
    });

    it('should return existing .i18nizer directory', () => {
      const expectedDir = path.join(testDir, '.i18nizer');
      fs.mkdirSync(expectedDir);
      
      const projectDir = getProjectDir(testDir);
      expect(projectDir).to.equal(expectedDir);
    });
  });

  describe('getMessagesDir', () => {
    it('should create messages directory based on config', () => {
      const config = generateConfig('react');
      const messagesDir = getMessagesDir(testDir, config);
      
      expect(fs.existsSync(messagesDir)).to.be.true;
      expect(messagesDir).to.include('messages');
    });

    it('should handle custom messages path', () => {
      const config = generateConfig('react');
      config.messages.path = 'locales';
      
      const messagesDir = getMessagesDir(testDir, config);
      expect(fs.existsSync(messagesDir)).to.be.true;
      expect(path.basename(messagesDir)).to.equal('locales');
    });
  });

  describe('AI provider configuration', () => {
    it('should include default AI provider and model in config', () => {
      const config = generateConfig('react');
      expect(config.ai).to.not.be.undefined;
      expect(config.ai!.provider).to.equal('openai');
      expect(config.ai!.model).to.equal('gpt-4');
    });

    it('should write and load AI configuration correctly', () => {
      const config = generateConfig('react');
      config.ai = { model: 'gemini-pro', provider: 'gemini' };
      writeConfig(testDir, config);

      const loadedConfig = loadConfig(testDir);
      expect(loadedConfig).to.not.be.null;
      expect(loadedConfig!.ai).to.not.be.undefined;
      expect(loadedConfig!.ai!.provider).to.equal('gemini');
      expect(loadedConfig!.ai!.model).to.equal('gemini-pro');
    });

    it('should validate AI provider and throw error for invalid provider', () => {
      const config = generateConfig('react');
      config.ai = { model: 'some-model', provider: 'invalid' as unknown as AiProvider };
      writeConfig(testDir, config);

      expect(() => loadConfig(testDir)).to.throw(/Invalid AI provider/);
    });

    it('should accept valid AI providers', () => {
      const validProviders: AiProvider[] = ['openai', 'gemini', 'huggingface'];
      
      for (const provider of validProviders) {
        const config = generateConfig('react');
        config.ai = { model: 'test-model', provider };
        writeConfig(testDir, config);

        const loadedConfig = loadConfig(testDir);
        expect(loadedConfig).to.not.be.null;
        expect(loadedConfig!.ai!.provider).to.equal(provider);
      }
    });
  });

  describe('Paths configuration', () => {
    it('should include default paths in config', () => {
      const config = generateConfig('react');
      expect(config.paths).to.not.be.undefined;
      expect(config.paths!.src).to.equal('src');
      expect(config.paths!.i18n).to.equal('i18n');
    });

    it('should write and load paths configuration correctly', () => {
      const config = generateConfig('react');
      config.paths = { i18n: 'locales', src: 'source' };
      writeConfig(testDir, config);

      const loadedConfig = loadConfig(testDir);
      expect(loadedConfig).to.not.be.null;
      expect(loadedConfig!.paths).to.not.be.undefined;
      expect(loadedConfig!.paths!.src).to.equal('source');
      expect(loadedConfig!.paths!.i18n).to.equal('locales');
    });

    it('should merge paths configuration with defaults', () => {
      const config = generateConfig('react');
      config.paths = { i18n: 'i18n', src: 'custom-src' };
      writeConfig(testDir, config);

      const loadedConfig = loadConfig(testDir);
      expect(loadedConfig).to.not.be.null;
      expect(loadedConfig!.paths!.src).to.equal('custom-src');
      expect(loadedConfig!.paths!.i18n).to.equal('i18n');
    });
  });

  describe('Backward compatibility', () => {
    it('should load old config without AI settings', () => {
      const oldConfig = {
        behavior: {
          allowedFunctions: ['alert'],
          allowedMemberFunctions: [],
          allowedProps: ['placeholder'],
          autoInjectT: true,
          detectDuplicates: true,
          opinionatedStructure: true,
          useAiForKeys: true
        },
        framework: 'react' as Framework,
        i18n: {
          function: 't',
          import: { named: 'useTranslation', source: 'react-i18next' }
        },
        messages: {
          defaultLocale: 'en',
          format: 'json' as const,
          locales: ['en', 'es'],
          path: 'messages'
        }
      };

      const configPath = path.join(testDir, 'i18nizer.config.yml');
      fs.writeFileSync(configPath, yaml.dump(oldConfig), 'utf8');

      const loadedConfig = loadConfig(testDir);
      expect(loadedConfig).to.not.be.null;
      expect(loadedConfig!.ai).to.not.be.undefined;
      expect(loadedConfig!.ai!.provider).to.equal('openai'); // Default from merge
      expect(loadedConfig!.paths).to.not.be.undefined;
      expect(loadedConfig!.paths!.src).to.equal('src'); // Default from merge
    });

    it('should load old config without paths settings', () => {
      const oldConfig = {
        ai: { model: 'gemini-pro', provider: 'gemini' },
        behavior: {
          allowedFunctions: ['alert'],
          allowedMemberFunctions: [],
          allowedProps: ['placeholder'],
          autoInjectT: true,
          detectDuplicates: true,
          opinionatedStructure: true,
          useAiForKeys: true
        },
        framework: 'react' as Framework,
        i18n: {
          function: 't',
          import: { named: 'useTranslation', source: 'react-i18next' }
        },
        messages: {
          defaultLocale: 'en',
          format: 'json' as const,
          locales: ['en', 'es'],
          path: 'messages'
        }
      };

      const configPath = path.join(testDir, 'i18nizer.config.yml');
      fs.writeFileSync(configPath, yaml.dump(oldConfig), 'utf8');

      const loadedConfig = loadConfig(testDir);
      expect(loadedConfig).to.not.be.null;
      expect(loadedConfig!.paths).to.not.be.undefined;
      expect(loadedConfig!.paths!.src).to.equal('src'); // Default from merge
      expect(loadedConfig!.paths!.i18n).to.equal('i18n'); // Default from merge
    });
  });
});
