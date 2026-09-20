import { expect } from 'chai';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { writeLocaleFiles } from '../../src/core/i18n/write-files.js';

describe('writeLocaleFiles - JSON Output Quality', () => {
  const testDir = path.join(os.tmpdir(), 'i18nizer-write-test-' + Date.now());

  before(() => {
    // Create test directory
    fs.mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { force: true, recursive: true });
    }
  });

  afterEach(() => {
    // Clean up after each test
    const messagesDir = path.join(testDir, 'messages');
    if (fs.existsSync(messagesDir)) {
      fs.rmSync(messagesDir, { force: true, recursive: true });
    }
  });

  it('should write JSON files for each locale', () => {
    const namespace = 'TestComponent';
    const data = {
      TestComponent: {
        signIn: {
          en: 'Sign in',
          es: 'Iniciar sesión',
        },
        welcomeBack: {
          en: 'Welcome back',
          es: 'Bienvenido de nuevo',
        },
      },
    };
    const locales = ['en', 'es'];
    const outputDir = path.join(testDir, 'messages');

    writeLocaleFiles(namespace, data, locales, outputDir);

    // Check en file - should use lowercase-hyphen format
    const enPath = path.join(outputDir, 'en', 'test-component.json');
    expect(fs.existsSync(enPath)).to.be.true;

    const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    expect(enContent).to.deep.equal({
      TestComponent: {
        signIn: 'Sign in',
        welcomeBack: 'Welcome back',
      },
    });

    // Check es file
    const esPath = path.join(outputDir, 'es', 'test-component.json');
    expect(fs.existsSync(esPath)).to.be.true;

    const esContent = JSON.parse(fs.readFileSync(esPath, 'utf8'));
    expect(esContent).to.deep.equal({
      TestComponent: {
        signIn: 'Iniciar sesión',
        welcomeBack: 'Bienvenido de nuevo',
      },
    });
  });

  it('should convert PascalCase namespace to lowercase-hyphen filename', () => {
    const namespace = 'NotificationItem';
    const data = {
      NotificationItem: {
        title: { en: 'Notification' },
      },
    };
    const locales = ['en'];
    const outputDir = path.join(testDir, 'messages');

    writeLocaleFiles(namespace, data, locales, outputDir);

    // Should create notification-item.json, not NotificationItem.json
    const filePath = path.join(outputDir, 'en', 'notification-item.json');
    expect(fs.existsSync(filePath)).to.be.true;

    // Old format should NOT exist
    const oldPath = path.join(outputDir, 'en', 'NotificationItem.json');
    expect(fs.existsSync(oldPath)).to.be.false;
  });

  it('should handle multi-word component names', () => {
    const testCases = [
      { expected: 'collapsible-text.json', namespace: 'CollapsibleText' },
      { expected: 'delete-model.json', namespace: 'DeleteModel' },
      { expected: 'collection-online-status-column.json', namespace: 'CollectionOnlineStatusColumn' },
      { expected: 'edit-permissions-dialog.json', namespace: 'EditPermissionsDialog' },
    ];

    for (const testCase of testCases) {
      const data = {
        [testCase.namespace]: {
          test: { en: 'Test' },
        },
      };
      const outputDir = path.join(testDir, 'messages');

      writeLocaleFiles(testCase.namespace, data, ['en'], outputDir);

      const filePath = path.join(outputDir, 'en', testCase.expected);
      expect(fs.existsSync(filePath)).to.be.true;
      
      // Clean up for next test
      fs.rmSync(filePath, { force: true });
    }
  });

  it('should sort keys alphabetically for stable output', () => {
    const namespace = 'Form';
    const data = {
      Form: {
        apply: { en: 'Apply' },
        cancel: { en: 'Cancel' },
        reset: { en: 'Reset' },
        submit: { en: 'Submit' },
      },
    };
    const locales = ['en'];
    const outputDir = path.join(testDir, 'messages');

    writeLocaleFiles(namespace, data, locales, outputDir);

    const filePath = path.join(outputDir, 'en', 'form.json');
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse and check key order
    const parsed = JSON.parse(content);
    const keys = Object.keys(parsed.Form);

    // Keys should be alphabetically sorted
    expect(keys).to.deep.equal(['apply', 'cancel', 'reset', 'submit']);
  });

  it('should format JSON with 2-space indentation', () => {
    const namespace = 'Component';
    const data = {
      Component: {
        key1: { en: 'Value 1' },
      },
    };
    const locales = ['en'];
    const outputDir = path.join(testDir, 'messages');

    writeLocaleFiles(namespace, data, locales, outputDir);

    const filePath = path.join(outputDir, 'en', 'component.json');
    const content = fs.readFileSync(filePath, 'utf8');

    // Check for 2-space indentation
    expect(content).to.include('  "Component":');
    expect(content).to.include('    "key1":');
  });

  it('should add trailing newline to JSON file', () => {
    const namespace = 'Component';
    const data = {
      Component: {
        key1: { en: 'Value 1' },
      },
    };
    const locales = ['en'];
    const outputDir = path.join(testDir, 'messages');

    writeLocaleFiles(namespace, data, locales, outputDir);

    const filePath = path.join(outputDir, 'en', 'component.json');
    const content = fs.readFileSync(filePath, 'utf8');

    // Check for trailing newline
    expect(content.endsWith('\n')).to.be.true;
  });

  it('should create nested directories if they do not exist', () => {
    const namespace = 'NewComponent';
    const data = {
      NewComponent: {
        test: { fr: 'Test' },
      },
    };
    const locales = ['fr'];
    const outputDir = path.join(testDir, 'messages');

    writeLocaleFiles(namespace, data, locales, outputDir);

    const filePath = path.join(outputDir, 'fr', 'new-component.json');
    expect(fs.existsSync(filePath)).to.be.true;
  });

  it('should produce deterministic output on multiple runs', () => {
    const namespace = 'Stable';
    const data = {
      Stable: {
        apple: { en: 'Apple' },
        mango: { en: 'Mango' },
        zebra: { en: 'Zebra' },
      },
    };
    const locales = ['en'];
    const outputDir = path.join(testDir, 'messages');

    // Write once
    writeLocaleFiles(namespace, data, locales, outputDir);
    const filePath = path.join(outputDir, 'en', 'stable.json');
    const content1 = fs.readFileSync(filePath, 'utf8');

    // Write again
    writeLocaleFiles(namespace, data, locales, outputDir);
    const content2 = fs.readFileSync(filePath, 'utf8');

    // Should be identical
    expect(content1).to.equal(content2);
  });

  it('should write Paraglide inlang-message-format files to messages/{locale}.json', () => {
    const namespace = 'Checkout';
    const paraglideData: Record<string, Record<string, Record<string, string>>> = {
      Checkout: {
        greeting: {
          de: 'Hallo {name}!',
          en: 'Hello {name}!',
        },
        welcome_message: {
          de: 'Willkommen zurück',
          en: 'Welcome back',
        },
      },
    };
    const data = {
      ...paraglideData,
    };
    const locales = ['en', 'de'];
    const outputDir = path.join(testDir, 'messages');
    const writeParaglideFiles = writeLocaleFiles as unknown as (
      namespace: string,
      data: Record<string, Record<string, Record<string, string>>>,
      locales: string[],
      outputDir: string,
      options: {
        format: 'inlang-message-format';
      }
    ) => void;

    writeParaglideFiles(namespace, data, locales, outputDir, {
      format: 'inlang-message-format',
    });

    const enPath = path.join(outputDir, 'en.json');
    const dePath = path.join(outputDir, 'de.json');

    expect(fs.existsSync(enPath)).to.be.true;
    expect(fs.existsSync(dePath)).to.be.true;
    expect(JSON.parse(fs.readFileSync(enPath, 'utf8'))).to.deep.equal({
      $schema: 'https://inlang.com/schema/inlang-message-format',
      greeting: 'Hello {name}!',
      welcome_message: 'Welcome back',
    });
    expect(JSON.parse(fs.readFileSync(dePath, 'utf8'))).to.deep.equal({
      $schema: 'https://inlang.com/schema/inlang-message-format',
      greeting: 'Hallo {name}!',
      welcome_message: 'Willkommen zurück',
    });
    expect(fs.existsSync(path.join(outputDir, 'en', 'checkout.json'))).to.be.false;
  });
});
