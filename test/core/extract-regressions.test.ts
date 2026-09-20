/* eslint-disable unicorn/consistent-function-scoping */
import { expect } from 'chai';
import { Project, ts } from 'ts-morph';

import { extractTexts } from '../../src/core/ast/extract-text.js';

describe('extract regression coverage', () => {
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

  it('should extract same-file string bindings used in JSX', () => {
    const code = `
      const greeting = "Hello there";

      export function Probe() {
        return <span>{greeting}</span>;
      }
    `;
    const sourceFile = createTestFile(code);
    const results = extractTexts(sourceFile);
    const texts = results.map((result) => result.text);

    expect(texts).to.include('Hello there');
  });

  it('should extract string arrays that are rendered through JSX maps', () => {
    const code = `
      const items = ["Apples", "Oranges", "Bananas"];

      export function Probe() {
        return <>{items.map((item) => <li key={item}>{item}</li>)}</>;
      }
    `;
    const sourceFile = createTestFile(code);
    const texts = extractTexts(sourceFile).map((result) => result.text);

    expect(texts).to.include.members(['Apples', 'Oranges', 'Bananas']);
  });

  it('should extract interpolated JSX sentences as a single message with placeholders', () => {
    const code = `
      export function Probe({ count }) {
        return <p>You have {count} new messages</p>;
      }
    `;
    const sourceFile = createTestFile(code);
    const results = extractTexts(sourceFile);
    const sentence = results.find((result) => result.text.includes('You have'));
    const texts = results.map((result) => result.text);

    expect(sentence).to.exist;
    expect(sentence!.text).to.equal('You have {count} new messages');
    expect(sentence!.placeholders).to.deep.equal(['count']);
    expect(texts).to.not.include('You have');
    expect(texts).to.not.include('new messages');
  });

  it('should preserve explicit line breaks across br tags', () => {
    const code = `
      export function Probe() {
        return <p>Line one.<br />Line two.</p>;
      }
    `;
    const sourceFile = createTestFile(code);
    const results = extractTexts(sourceFile);

    expect(results.map((result) => result.text)).to.include('Line one.\nLine two.');
  });

  it('should preserve meaningful edge whitespace in JSX text', () => {
    const code = `
      export function Probe() {
        return (
          <>
            <span>Ends with space </span>
            <span>  Leading/trailing  </span>
          </>
        );
      }
    `;
    const sourceFile = createTestFile(code);
    const texts = extractTexts(sourceFile).map((result) => result.text);

    expect(texts).to.include('Ends with space ');
    expect(texts).to.include('  Leading/trailing  ');
  });
});
