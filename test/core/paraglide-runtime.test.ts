/* eslint-disable unicorn/consistent-function-scoping */
import { expect } from 'chai';
import { Project, ts } from 'ts-morph';

import { extractTexts } from '../../src/core/ast/extract-text.js';
import { insertUseTranslations } from '../../src/core/ast/insert-user-translations.js';
import { ReplaceOptions, replaceTempKeysWithT } from '../../src/core/ast/replace-text-with-text.js';

describe('Paraglide runtime support', () => {
  function createTestFile(code: string) {
    const project = new Project({
      compilerOptions: {
        allowJs: true,
        esModuleInterop: true,
        jsx: ts.JsxEmit.React,
        skipLibCheck: true,
        strict: false,
        target: ts.ScriptTarget.ES2022,
      },
      useInMemoryFileSystem: true,
    });

    return project.createSourceFile('test.tsx', code);
  }

  it('should replace JSX text with m.key_name() calls when Paraglide mode is enabled', () => {
    const code = `
      export default function LoginForm() {
        return <button>Sign in</button>;
      }
    `;
    const sourceFile = createTestFile(code);
    const results = extractTexts(sourceFile);
    const options = {
      i18nLibrary: 'paraglide-js',
    } as unknown as ReplaceOptions;

    replaceTempKeysWithT(
      [
        {
          key: 'sign_in',
          node: results[0].node,
          placeholders: results[0].placeholders,
          tempKey: results[0].tempKey,
        },
      ],
      options
    );

    const updatedCode = sourceFile.getText();
    expect(updatedCode).to.include('{m.sign_in()}');
    expect(updatedCode).to.not.include('t("sign_in")');
  });

  it('should rewrite placeholders to Paraglide message functions with params objects', () => {
    const code = `
      export default function WelcomeBanner({ name }) {
        return <div>{\`Hello \${name}, welcome!\`}</div>;
      }
    `;
    const sourceFile = createTestFile(code);
    const results = extractTexts(sourceFile);
    const templateResult = results.find((result) => result.placeholders.length > 0)!;
    const options = {
      i18nLibrary: 'paraglide-js',
    } as unknown as ReplaceOptions;

    replaceTempKeysWithT(
      [
        {
          key: 'greeting_message',
          node: templateResult.node,
          placeholders: templateResult.placeholders,
          tempKey: templateResult.tempKey,
        },
      ],
      options
    );

    const updatedCode = sourceFile.getText();
    expect(updatedCode).to.match(/m\.greeting_message\(\{\s*name(?::\s*name)?\s*\}\)/);
    expect(updatedCode).to.not.include('t("greeting_message"');
  });

  it('should inject the Paraglide runtime import instead of useTranslations()', () => {
    const code = `
      export default function LoginForm() {
        return <button>Sign in</button>;
      }
    `;
    const sourceFile = createTestFile(code);
    const injectParaglideImport = insertUseTranslations as unknown as (
      sourceFile: ReturnType<typeof createTestFile>,
      namespace: string,
      options: {
        i18nLibrary: string;
        import: {
          named: string;
          source: string;
        };
      }
    ) => void;

    injectParaglideImport(sourceFile, 'LoginForm', {
      i18nLibrary: 'paraglide-js',
      import: {
        named: 'm',
        source: './paraglide/messages.js',
      },
    });

    const updatedCode = sourceFile.getText();
    expect(updatedCode).to.include('import { m } from "./paraglide/messages.js";');
    expect(updatedCode).to.not.include('useTranslations("LoginForm")');
  });
});
