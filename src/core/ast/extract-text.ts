/* eslint-disable complexity */
import { JsxElement, JsxFragment, Node } from "ts-morph";

import { isTranslatableString } from "./is-translatable.js";

let tempIdCounter = 0;

// Default sets - can be overridden via extractTexts options
const defaultAllowedFunctions = new Set(["alert", "confirm", "prompt"]);
const defaultAllowedMemberFunctions = new Set(["toast.error", "toast.info", "toast.success", "toast.warn"]);
const defaultAllowedProps = new Set([
    "alt",
    "aria-label",
    "aria-placeholder",
    "helperText",
    "label",
    "placeholder",
    "text",
    "title",
    "tooltip",
]);

export interface ExtractedText {
    node: Node;
    placeholders: string[];
    sequenceNodes?: Node[];
    tempKey: string;
    text: string;
    isPlural?: boolean;
    pluralVariable?: string;
    pluralForms?: {
        one: string;
        other: string;
    };
    isRichText?: boolean;
    richTextElements?: Array<{
        tag: string;
        placeholder: string;
    }>;
}

export interface ExtractOptions {
    allowedFunctions?: string[];
    allowedMemberFunctions?: string[];
    allowedProps?: string[];
}

// --- Helpers ---

function isJsxContainer(node: Node): node is JsxElement | JsxFragment {
    return Node.isJsxElement(node) || Node.isJsxFragment(node);
}

function normalizeFormattedJsxText(text: string): string {
    if (!/[\n\r\t]/.test(text)) {
        return text;
    }

    return text
        .replaceAll(/\s*\n\s*/g, " ")
        .replaceAll(/[ \t]{2,}/g, " ");
}

function processTemplateLiteral(node: Node): null | { placeholders: string[]; text: string } {
    if (Node.isNoSubstitutionTemplateLiteral(node)) {
        return { placeholders: [], text: node.getLiteralText() };
    }

    if (Node.isTemplateExpression(node)) {
        let text = node.getHead().getLiteralText();
        const placeholders: string[] = [];
        for (const span of node.getTemplateSpans()) {
            const exprText = span.getExpression().getText();
            const literalText = span.getLiteral().getLiteralText();
            text += `{${exprText}}${literalText}`;
            placeholders.push(exprText);
        }

        return { placeholders, text };
    }

    return null;
}

/**
 * Extract rich text content from JSX element with child elements
 * Converts: <p>Click <a>here</a> to continue</p>
 * To: "Click <a>here</a> to continue"
 */
function extractRichTextContent(jsxElement: Node): null | {
    text: string;
    elements: Array<{ tag: string; placeholder: string }>;
} {
    if (!Node.isJsxElement(jsxElement)) {
        return null;
    }

    const pattern = detectRichTextPattern(jsxElement);
    if (!pattern) {
        return null;
    }

    const children = jsxElement.getJsxChildren();
    let richText = '';
    const elements: Array<{ tag: string; placeholder: string }> = [];
    const seenPlaceholders = new Set<string>();

    for (const child of children) {
        if (Node.isJsxText(child)) {
            richText += normalizeFormattedJsxText(child.getFullText());
        } else if (Node.isJsxElement(child)) {
            const opening = child.getOpeningElement();
            const tagName = opening.getTagNameNode().getText();
            const placeholder = tagName.toLowerCase();

            // Get inner text of the element
            const innerText = child.getJsxChildren()
                .filter(c => Node.isJsxText(c))
                .map(c => normalizeFormattedJsxText(c.getFullText()))
                .join('');

            // Add to rich text with placeholder
            richText += `<${placeholder}>${innerText}</${placeholder}>`;

            // Track unique elements
            if (!seenPlaceholders.has(placeholder)) {
                elements.push({ tag: tagName, placeholder });
                seenPlaceholders.add(placeholder);
            }
        }
    }

    return {
        elements,
        text: richText.trim(),
    };
}

/**
 * Detect rich text pattern - JSX element containing both text and child JSX elements
 * Example: <p>Click <a>here</a> to continue</p>
 */
function detectRichTextPattern(jsxElement: Node): null | {
    elements: Array<{ tag: string; placeholder: string }>;
    hasText: boolean;
} {
    if (!Node.isJsxElement(jsxElement)) {
        return null;
    }

    const children = jsxElement.getJsxChildren();
    let hasText = false;
    let hasJsxElement = false;
    const elements: Array<{ tag: string; placeholder: string }> = [];

    for (const child of children) {
        if (Node.isJsxText(child)) {
            const text = normalizeFormattedJsxText(child.getFullText()).trim();
            if (text.length > 0) {
                hasText = true;
            }
        } else if (Node.isJsxElement(child)) {
            hasJsxElement = true;

            // Get tag name
            const tagName = child.getOpeningElement().getTagNameNode().getText();

            // Generate placeholder name based on tag
            const placeholder = tagName.toLowerCase();
            elements.push({ tag: tagName, placeholder });
        }
    }

    // Rich text pattern: has both text and JSX elements
    if (hasText && hasJsxElement) {
        return { elements, hasText: true };
    }

    return null;
}

/**
 * Detect pluralization pattern in a ternary expression
 * Pattern: variable === 1 ? 'singular' : 'plural'
 */
function detectPluralizationPattern(expr: Node): null | {
    pluralVariable: string;
    one: string;
    other: string;
} {
    if (!Node.isConditionalExpression(expr)) return null;

    const condition = expr.getCondition();
    const whenTrue = expr.getWhenTrue();
    const whenFalse = expr.getWhenFalse();

    // Check if condition is a binary expression (e.g., count === 1 or count == 1)
    if (!Node.isBinaryExpression(condition)) return null;

    const operator = condition.getOperatorToken().getText();
    if (operator !== "===" && operator !== "==") return null;

    const left = condition.getLeft();
    const right = condition.getRight();

    // Check if one side is 1 and the other is a variable
    let variable: null | string = null;
    let isCheckingForOne = false;

    if (Node.isNumericLiteral(right) && right.getLiteralValue() === 1 && Node.isIdentifier(left)) {
        variable = left.getText();
        isCheckingForOne = true;
    } else if (Node.isNumericLiteral(left) && left.getLiteralValue() === 1 && Node.isIdentifier(right)) {
        variable = right.getText();
        isCheckingForOne = true;
    }

    if (!variable || !isCheckingForOne) return null;

    // Extract singular and plural forms
    let singular: null | string = null;
    let plural: null | string = null;

    if (Node.isStringLiteral(whenTrue)) {
        singular = whenTrue.getLiteralText();
    }

    if (Node.isStringLiteral(whenFalse)) {
        plural = whenFalse.getLiteralText();
    }

    if (!singular || !plural) return null;

    return {
        pluralVariable: variable,
        one: singular,
        other: plural,
    };
}

function getFullCallName(node: Node): null | string {
    if (Node.isIdentifier(node)) return node.getText();
    if (Node.isPropertyAccessExpression(node)) {
        const expr = getFullCallName(node.getExpression());
        if (expr) return `${expr}.${node.getName()}`;
    }

    return null;
}

function isVariableUsedInJsx(variableDeclaration: Node): boolean {
    if (!Node.isVariableDeclaration(variableDeclaration)) {
        return false;
    }

    const nameNode = variableDeclaration.getNameNode();
    const variableName = nameNode.getText();

    return variableDeclaration
        .getSourceFile()
        .getDescendants()
        .some((descendant) => {
            if (!Node.isIdentifier(descendant) || descendant.getText() !== variableName) {
                return false;
            }

            if (descendant.getStart() === nameNode.getStart()) {
                return false;
            }

            return Boolean(descendant.getFirstAncestor((ancestor) => Node.isJsxExpression(ancestor)));
        });
}

function addExtractedText(
    node: Node,
    text: string,
    results: ExtractedText[],
    seenNodes: Set<Node>,
    placeholders: string[] = [],
    sequenceNodes?: Node[]
) {
    if (!isTranslatableString(node, text)) {
        return;
    }

    const tempKey = `i$fdw_${tempIdCounter++}`;
    results.push({ node, placeholders, sequenceNodes, tempKey, text });
    seenNodes.add(node);

    if (sequenceNodes) {
        for (const sequenceNode of sequenceNodes) {
            seenNodes.add(sequenceNode);
        }
    }
}

function extractStringsFromVariableInitializer(
    initializer: Node,
    results: ExtractedText[],
    seenNodes: Set<Node>
) {
    if (Node.isArrayLiteralExpression(initializer)) {
        for (const element of initializer.getElements()) {
            extractStringsFromExpression(element, results, seenNodes);
        }
        return;
    }

    extractStringsFromExpression(initializer, results, seenNodes);
}

function getSequenceExpressionFragment(expr: Node): null | { placeholders: string[]; text: string } {
    if (Node.isIdentifier(expr)) {
        return {
            placeholders: [expr.getText()],
            text: `{${expr.getText()}}`,
        };
    }

    if (Node.isNumericLiteral(expr)) {
        return {
            placeholders: [],
            text: expr.getText(),
        };
    }

    if (Node.isStringLiteral(expr)) {
        return {
            placeholders: [],
            text: expr.getLiteralText(),
        };
    }

    if (Node.isNoSubstitutionTemplateLiteral(expr) || Node.isTemplateExpression(expr)) {
        return processTemplateLiteral(expr);
    }

    if (Node.isParenthesizedExpression(expr)) {
        return getSequenceExpressionFragment(expr.getExpression());
    }

    return null;
}

function extractJsxSequence(jsxNode: Node): null | {
    node: Node;
    placeholders: string[];
    sequenceNodes: Node[];
    text: string;
} {
    if (!isJsxContainer(jsxNode)) {
        return null;
    }

    const children = jsxNode.getJsxChildren();
    const sequenceNodes: Node[] = [];
    const placeholders: string[] = [];
    let hasTextOrBreak = false;
    let meaningfulNodeCount = 0;
    let text = "";

    for (const child of children) {
        if (Node.isJsxText(child)) {
            if (child.getFullText().trim().length === 0) {
                continue;
            }

            sequenceNodes.push(child);
            meaningfulNodeCount++;
            hasTextOrBreak = true;
            text += normalizeFormattedJsxText(child.getFullText());
            continue;
        }

        if (Node.isJsxSelfClosingElement(child)) {
            if (child.getTagNameNode().getText() !== "br") {
                return null;
            }

            sequenceNodes.push(child);
            meaningfulNodeCount++;
            hasTextOrBreak = true;
            text += "\n";
            continue;
        }

        if (Node.isJsxExpression(child)) {
            const expr = child.getExpression();
            if (!expr) {
                continue;
            }

            const fragment = getSequenceExpressionFragment(expr);
            if (!fragment) {
                return null;
            }

            sequenceNodes.push(child);
            meaningfulNodeCount++;
            text += fragment.text;
            placeholders.push(...fragment.placeholders);
            continue;
        }

        return null;
    }

    if (!hasTextOrBreak || meaningfulNodeCount <= 1 || sequenceNodes.length === 0) {
        return null;
    }

    return {
        node: sequenceNodes[0],
        placeholders,
        sequenceNodes,
        text,
    };
}

/**
 * Recursively extract string literals from complex expressions
 * like ternary operators, logical operators, etc.
 */
function extractStringsFromExpression(expr: Node, results: ExtractedText[], seenNodes: Set<Node>): void {
    if (!expr || seenNodes.has(expr)) return;

    // String literal
    if (Node.isStringLiteral(expr)) {
        const text = expr.getLiteralText();
        addExtractedText(expr, text, results, seenNodes);

        return;
    }

    // Template literal
    if (Node.isTemplateExpression(expr) || Node.isNoSubstitutionTemplateLiteral(expr)) {
        const processed = processTemplateLiteral(expr);
        if (processed) {
            addExtractedText(expr, processed.text, results, seenNodes, processed.placeholders);
        }

        return;
    }

    // Ternary operator: condition ? whenTrue : whenFalse
    if (Node.isConditionalExpression(expr)) {
        // Check if this is a pluralization pattern
        const pluralPattern = detectPluralizationPattern(expr);

        if (pluralPattern) {
            // This is a pluralization pattern, create a single entry for it
            const tempKey = `i$fdw_${tempIdCounter++}`;
            const text = pluralPattern.other; // Use plural form as base text

            results.push({
                node: expr,
                placeholders: [pluralPattern.pluralVariable],
                tempKey,
                text,
                isPlural: true,
                pluralVariable: pluralPattern.pluralVariable,
                pluralForms: {
                    one: pluralPattern.one,
                    other: pluralPattern.other,
                },
            });
            seenNodes.add(expr);
            // Mark child nodes as seen to avoid duplicate extraction
            seenNodes.add(expr.getWhenTrue());
            seenNodes.add(expr.getWhenFalse());
            return;
        }

        // Not a pluralization pattern, extract strings normally
        extractStringsFromExpression(expr.getWhenTrue(), results, seenNodes);
        extractStringsFromExpression(expr.getWhenFalse(), results, seenNodes);
        return;
    }

    // Binary expressions: logical AND (&&) and OR (||)
    if (Node.isBinaryExpression(expr)) {
        const operator = expr.getOperatorToken().getText();
        if (operator === "&&" || operator === "||") {
            // Extract from both sides to handle cases like 'text1' || 'text2'
            extractStringsFromExpression(expr.getLeft(), results, seenNodes);
            extractStringsFromExpression(expr.getRight(), results, seenNodes);
        }

        return;
    }

    // Parenthesized expression: (expression)
    if (Node.isParenthesizedExpression(expr)) {
        extractStringsFromExpression(expr.getExpression(), results, seenNodes);

    }
}

// --- Extractor ---
export function extractTexts(sourceFile: Node, options: ExtractOptions = {}): ExtractedText[] {
    const allowedFunctions = new Set(options.allowedFunctions ?? [...defaultAllowedFunctions]);
    const allowedMemberFunctions = new Set(options.allowedMemberFunctions ?? [...defaultAllowedMemberFunctions]);
    const allowedProps = new Set(options.allowedProps ?? [...defaultAllowedProps]);

    const results: ExtractedText[] = [];
    const seenNodes = new Set<Node>();

    sourceFile.forEachDescendant((node: Node) => {
        if (seenNodes.has(node)) return;

        if (Node.isVariableDeclaration(node) && isVariableUsedInJsx(node)) {
            const initializer = node.getInitializer();
            if (initializer) {
                extractStringsFromVariableInitializer(initializer, results, seenNodes);
            }
        }

        // Check for rich text pattern in JSX elements
        if (Node.isJsxElement(node)) {
            const richContent = extractRichTextContent(node);
            if (richContent) {
                const tempKey = `i$fdw_${tempIdCounter++}`;
                results.push({
                    isRichText: true,
                    node,
                    placeholders: richContent.elements.map(e => e.placeholder),
                    richTextElements: richContent.elements,
                    tempKey,
                    text: richContent.text,
                });
                seenNodes.add(node);

                // Mark all children as seen to avoid duplicate extraction
                node.getJsxChildren().forEach(child => seenNodes.add(child));
                return;
            }
        }

        if (isJsxContainer(node)) {
            const sequence = extractJsxSequence(node);
            if (sequence) {
                addExtractedText(
                    sequence.node,
                    sequence.text,
                    results,
                    seenNodes,
                    sequence.placeholders,
                    sequence.sequenceNodes
                );
                return;
            }
        }

        let text: null | string = null;
        let placeholders: string[] = [];

        // JSXText
        if (Node.isJsxText(node)) {
            const parent = node.getParent();

            // Solo permitir texto visible dentro de un elemento JSX
            if (!isJsxContainer(parent)) return;

            const rawText = node.getFullText();
            if (rawText.trim().length === 0) return;
            text = /[\n\r\t]/.test(rawText)
                ? normalizeFormattedJsxText(rawText).trim()
                : rawText;
            if (!isTranslatableString(node, text)) return;

            addExtractedText(node, text, results, seenNodes, placeholders);
            return;
        }

        // JSXExpression - handle complex expressions
        if (Node.isJsxExpression(node)) {
            const expr = node.getExpression();
            if (!expr) return;

            const parent = node.getParent();

            let shouldExtract = false;

            if (Node.isJsxAttribute(parent)) {
                const propName = parent.getNameNode().getText();
                if (allowedProps.has(propName)) {
                    shouldExtract = true;
                }
            }

            if (isJsxContainer(parent)) {
                shouldExtract = true;
            }

            if (!shouldExtract) return;

            extractStringsFromExpression(expr, results, seenNodes);
            return;
        }

        // StringLiteral in JSX attributes or function calls
        if (Node.isStringLiteral(node)) {
            text = node.getLiteralText();
        }

        // Template literals in function calls
        else if (Node.isTemplateExpression(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
            const processed = processTemplateLiteral(node);
            if (processed) {
                text = processed.text;
                placeholders = processed.placeholders;
            }
        }

        if (!text) return;
        if (!isTranslatableString(node, text)) return;

        const parent = node.getParent();

        let shouldExtract = false;

        // Check if this is in a JSX attribute that we care about
        if (Node.isJsxAttribute(parent) && allowedProps.has(parent.getNameNode().getText())) {
            shouldExtract = true;
        }
        // Check if this is in an allowed function call
        else if (Node.isCallExpression(parent)) {
            const fnName = getFullCallName(parent.getExpression());
            if (fnName && (allowedFunctions.has(fnName) || allowedMemberFunctions.has(fnName))) {
                shouldExtract = true;
            }
        }
        // Check if string is inside a JSX expression within an attribute
        else if (Node.isJsxExpression(parent)) {
            const jsxExprParent = parent.getParent();
            if (Node.isJsxAttribute(jsxExprParent) && allowedProps.has(jsxExprParent.getNameNode().getText())) {
                shouldExtract = true;
            }
        }

        if (shouldExtract) {
            addExtractedText(node, text, results, seenNodes, placeholders);
        }
    });

    return results;
}
