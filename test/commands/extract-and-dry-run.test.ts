import { expect } from 'chai';
import yaml from 'js-yaml';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../../bin/run.js', import.meta.url));
const inlangSchemaUrl = 'https://inlang.com/schema/inlang-message-format';

describe('extract and dry-run integration', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `i18nizer-cli-test-${Date.now()}`);
    fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { force: true, recursive: true });
    }
  });

  function runCli(args: string[]) {
    return spawnSync(process.execPath, [cliPath, ...args], {
      cwd: testDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
      },
    });
  }

  function writeConfig(config: Record<string, unknown>) {
    fs.writeFileSync(
      path.join(testDir, 'i18nizer.config.yml'),
      yaml.dump(config),
      'utf8'
    );
  }

  function createLegacyConfig() {
    return {
      behavior: {
        allowedFunctions: ['alert', 'confirm', 'prompt'],
        allowedMemberFunctions: ['toast.error', 'toast.info', 'toast.success', 'toast.warn'],
        allowedProps: ['alt', 'aria-label', 'aria-placeholder', 'helperText', 'label', 'placeholder', 'text', 'title', 'tooltip'],
        autoInjectT: true,
        detectDuplicates: true,
        opinionatedStructure: true,
        useAiForKeys: false,
      },
      framework: 'react',
      i18n: {
        function: 't',
        import: {
          named: 'useTranslation',
          source: 'react-i18next',
        },
      },
      i18nLibrary: 'react-i18next',
      messages: {
        defaultLocale: 'en',
        format: 'json',
        locales: ['en'],
        path: 'messages',
      },
    };
  }

  function createParaglideConfig() {
    return {
      behavior: {
        allowedFunctions: ['alert', 'confirm', 'prompt'],
        allowedMemberFunctions: ['toast.error', 'toast.info', 'toast.success', 'toast.warn'],
        allowedProps: ['alt', 'aria-label', 'aria-placeholder', 'helperText', 'label', 'placeholder', 'text', 'title', 'tooltip'],
        autoInjectT: true,
        detectDuplicates: true,
        opinionatedStructure: true,
        useAiForKeys: false,
      },
      framework: 'react',
      i18n: {
        function: 'm',
        import: {
          named: 'm',
          source: './paraglide/messages.js',
        },
      },
      i18nLibrary: 'paraglide-js',
      messages: {
        defaultLocale: 'en',
        format: 'inlang-message-format',
        locales: ['en'],
        path: 'messages',
      },
    };
  }

  it('should run translate --dry-run without AI and without writing project files', () => {
    const componentPath = path.join(testDir, 'src', 'LoginForm.tsx');
    const originalSource = `
      export default function LoginForm() {
        return <button>Sign in</button>;
      }
    `;

    fs.writeFileSync(componentPath, originalSource, 'utf8');
    writeConfig(createLegacyConfig());

    const result = runCli(['translate', 'src/LoginForm.tsx', '--dry-run', '--locales', 'en']);

    expect(result.status, `${result.stdout}\n${result.stderr}`).to.equal(0);
    expect(fs.readFileSync(componentPath, 'utf8')).to.equal(originalSource);
    expect(fs.existsSync(path.join(testDir, '.i18nizer'))).to.be.false;
    expect(fs.existsSync(path.join(testDir, 'messages'))).to.be.false;
  });

  it('should run extract --dry-run without writing message files', () => {
    const componentPath = path.join(testDir, 'src', 'LoginForm.tsx');
    const originalSource = `
      export default function LoginForm() {
        return <button>Sign in</button>;
      }
    `;

    fs.writeFileSync(componentPath, originalSource, 'utf8');
    writeConfig(createParaglideConfig());

    const result = runCli(['extract', 'src/LoginForm.tsx', '--dry-run', '--locales', 'en,es']);

    expect(result.status, `${result.stdout}\n${result.stderr}`).to.equal(0);
    expect(result.stdout).to.include('DRY RUN MODE');
    expect(fs.readFileSync(componentPath, 'utf8')).to.equal(originalSource);
    expect(fs.existsSync(path.join(testDir, 'messages', 'en.json'))).to.be.false;
    expect(fs.existsSync(path.join(testDir, 'messages', 'en', 'login-form.json'))).to.be.false;
  });

  it('should run extract without AI and write only the default locale in legacy JSON format', () => {
    const componentPath = path.join(testDir, 'src', 'LoginForm.tsx');
    const originalSource = `
      export default function LoginForm() {
        return <button>Sign in</button>;
      }
    `;

    fs.writeFileSync(componentPath, originalSource, 'utf8');
    writeConfig(createLegacyConfig());

    const result = runCli(['extract', 'src/LoginForm.tsx', '--locales', 'en,es']);
    const messagePath = path.join(testDir, 'messages', 'en', 'login-form.json');

    expect(result.status, `${result.stdout}\n${result.stderr}`).to.equal(0);
    expect(fs.readFileSync(componentPath, 'utf8')).to.equal(originalSource);
    expect(fs.existsSync(messagePath)).to.be.true;
    expect(JSON.parse(fs.readFileSync(messagePath, 'utf8'))).to.deep.equal({
      LoginForm: {
        signIn: 'Sign in',
      },
    });
    expect(fs.existsSync(path.join(testDir, 'messages', 'es'))).to.be.false;
  });

  it('should run extract without AI and emit Paraglide inlang-message-format files out of the box', () => {
    const componentPath = path.join(testDir, 'src', 'LoginForm.tsx');
    const originalSource = `
      export default function LoginForm() {
        return <button>Sign in</button>;
      }
    `;

    fs.writeFileSync(componentPath, originalSource, 'utf8');
    writeConfig(createParaglideConfig());

    const result = runCli(['extract', 'src/LoginForm.tsx', '--locales', 'en,es']);
    const messagePath = path.join(testDir, 'messages', 'en.json');

    expect(result.status, `${result.stdout}\n${result.stderr}`).to.equal(0);
    expect(fs.readFileSync(componentPath, 'utf8')).to.equal(originalSource);
    expect(fs.existsSync(messagePath)).to.be.true;
    expect(JSON.parse(fs.readFileSync(messagePath, 'utf8'))).to.deep.equal({
      $schema: inlangSchemaUrl,
      sign_in: 'Sign in',
    });
    expect(fs.existsSync(path.join(testDir, 'messages', 'es.json'))).to.be.false;
    expect(fs.existsSync(path.join(testDir, 'messages', 'en', 'login-form.json'))).to.be.false;
  });

  it('should extract complex probe content without dropping bindings or separators in Paraglide mode', () => {
    const componentPath = path.join(testDir, 'src', 'Probe.tsx');
    const source = `
      import { Button } from "./button";

      export function Probe() {
        const greeting = "Hello there";
        const count = 3;
        const items = ["Apples", "Oranges", "Bananas"];

        return (
          <div title="Tooltip text" aria-label="Accessible name">
            <h1>Welcome back</h1>
            <p>You have {count} new messages</p>
            <img src="/x.png" alt="A cat sitting" />
            <input placeholder="Enter your email" />
            <Button label="Save changes" disabled={false}>Click me</Button>
            <span>{greeting}</span>
            <span>{"Literal in braces"}</span>
            <span>Ends with space </span>
            <span>  Leading/trailing  </span>
            <>Fragment text</>
            {items.map((item) => <li key={item}>{item}</li>)}
            <p>Line one.<br />Line two.</p>
            <a href="/x">Read the docs</a>
            <button onClick={() => alert("Are you sure?")}>Delete</button>
          </div>
        );
      }
    `;

    fs.writeFileSync(componentPath, source, 'utf8');
    writeConfig(createParaglideConfig());

    const result = runCli(['extract', 'src/Probe.tsx', '--locales', 'en']);
    const messagePath = path.join(testDir, 'messages', 'en.json');
    const output = JSON.parse(fs.readFileSync(messagePath, 'utf8')) as Record<string, string>;
    const values = Object.values(output);

    expect(result.status, `${result.stdout}\n${result.stderr}`).to.equal(0);
    expect(result.stdout).to.include('Provider: deterministic');
    expect(values).to.include.members([
      'A cat sitting',
      'Accessible name',
      'Apples',
      'Are you sure?',
      'Bananas',
      'Click me',
      'Delete',
      'Ends with space ',
      'Enter your email',
      'Fragment text',
      'Hello there',
      'Line one.\nLine two.',
      'Literal in braces',
      'Oranges',
      'Read the docs',
      'Save changes',
      'Tooltip text',
      'Welcome back',
      'You have {count} new messages',
      '  Leading/trailing  ',
    ]);
    expect(values).to.not.include('You have');
    expect(values).to.not.include('new messages');
  });

  it('should avoid overwriting existing Paraglide keys when later extracts collide', () => {
    const firstPath = path.join(testDir, 'src', 'FirstButton.tsx');
    const secondPath = path.join(testDir, 'src', 'SecondButton.tsx');

    fs.writeFileSync(
      firstPath,
      'export function FirstButton() { return <button>Save!</button>; }',
      'utf8'
    );
    fs.writeFileSync(
      secondPath,
      'export function SecondButton() { return <button>Save?</button>; }',
      'utf8'
    );
    writeConfig(createParaglideConfig());

    const firstRun = runCli(['extract', 'src/FirstButton.tsx', '--locales', 'en']);
    const secondRun = runCli(['extract', 'src/SecondButton.tsx', '--locales', 'en']);
    const output = JSON.parse(
      fs.readFileSync(path.join(testDir, 'messages', 'en.json'), 'utf8')
    ) as Record<string, string>;
    const messageEntries = Object.entries(output).filter(([key]) => key !== '$schema');
    const values = messageEntries.map(([, value]) => value);

    expect(firstRun.status, `${firstRun.stdout}\n${firstRun.stderr}`).to.equal(0);
    expect(secondRun.status, `${secondRun.stdout}\n${secondRun.stderr}`).to.equal(0);
    expect(values).to.include('Save!');
    expect(values).to.include('Save?');
    expect(new Set(messageEntries.map(([key]) => key)).size).to.equal(messageEntries.length);
  });
});
