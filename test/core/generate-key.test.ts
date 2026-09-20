import { expect } from 'chai';

import { generateKey, generateUniqueKey } from '../../src/core/i18n/generate-key.js';

describe('Key Generation', () => {
  describe('generateKey', () => {
    it('should generate camelCase key from simple text', () => {
      const key = generateKey('Welcome back');
      expect(key).to.equal('welcomeBack');
    });

    it('should generate camelCase key from sentence', () => {
      const key = generateKey('Please sign in to continue');
      expect(key).to.equal('pleaseSignInToContinue');
    });

    it('should handle special characters', () => {
      const key = generateKey('User\'s Profile Settings');
      expect(key).to.equal('usersProfileSettings');
    });

    it('should handle punctuation', () => {
      const key = generateKey('Hello, world!');
      expect(key).to.equal('helloWorld');
    });

    it('should limit to first 5 words', () => {
      const key = generateKey('This is a very long sentence with many words in it');
      const words = key.match(/[A-Z]?[a-z]+/g) || [];
      expect(words.length).to.be.at.most(5);
    });

    it('should handle text with numbers', () => {
      const key = generateKey('Step 1 of 3');
      expect(key).to.equal('step1Of3');
    });

    it('should handle text with template placeholders', () => {
      const key = generateKey('Hello {name}, welcome!');
      expect(key).to.equal('helloWelcome');
    });

    it('should handle multiple template placeholders', () => {
      const key = generateKey('{count} items selected');
      expect(key).to.equal('itemsSelected');
    });

    it('should return default for very short text', () => {
      const key = generateKey('A');
      expect(key).to.equal('text');
    });

    it('should handle text with only special characters gracefully', () => {
      const key = generateKey('...');
      expect(key).to.equal('text');
    });

    it('should generate deterministic fallback keys for non-Latin text', () => {
      const key = generateKey('こんにちは世界');
      expect(key).to.match(/^text[0-9a-f]{8}$/);
      expect(generateKey('こんにちは世界')).to.equal(key);
    });

    it('should generate distinct fallback keys for different non-Latin text', () => {
      expect(generateKey('こんにちは世界')).to.not.equal(generateKey('你好世界'));
    });

    it('should be deterministic - same input produces same output', () => {
      const text = 'Enter your email address';
      const key1 = generateKey(text);
      const key2 = generateKey(text);
      expect(key1).to.equal(key2);
    });

    it('should handle mixed case input', () => {
      const key = generateKey('SUBMIT FORM');
      expect(key).to.equal('submitForm');
    });

    it('should handle hyphenated text', () => {
      const key = generateKey('User-friendly interface');
      expect(key).to.equal('userFriendlyInterface');
    });

    it('should handle underscored text', () => {
      const key = generateKey('first_name last_name');
      expect(key).to.equal('firstNameLastName');
    });
  });

  describe('generateUniqueKey', () => {
    it('should return base key if not in existing keys', () => {
      const existingKeys = new Set(['otherKey']);
      const key = generateUniqueKey('welcomeBack', existingKeys);
      expect(key).to.equal('welcomeBack');
    });

    it('should append 2 if base key exists', () => {
      const existingKeys = new Set(['welcomeBack']);
      const key = generateUniqueKey('welcomeBack', existingKeys);
      expect(key).to.equal('welcomeBack2');
    });

    it('should increment counter if multiple keys exist', () => {
      const existingKeys = new Set(['submit', 'submit2', 'submit3']);
      const key = generateUniqueKey('submit', existingKeys);
      expect(key).to.equal('submit4');
    });

    it('should handle empty existing keys set', () => {
      const existingKeys = new Set<string>();
      const key = generateUniqueKey('newKey', existingKeys);
      expect(key).to.equal('newKey');
    });

    it('should be deterministic given same inputs', () => {
      const existingKeys = new Set(['test', 'test2']);
      const key1 = generateUniqueKey('test', existingKeys);
      const key2 = generateUniqueKey('test', existingKeys);
      expect(key1).to.equal(key2);
      expect(key1).to.equal('test3');
    });
  });
});
