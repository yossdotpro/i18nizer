import { Block, SourceFile, SyntaxKind, VariableDeclaration, VariableDeclarationKind } from "ts-morph";

export interface InsertTranslationsOptions {
    i18nLibrary?: string;
    import?: {
        named: string;
        source: string;
    };
}

function ensureNamedImport(
    sourceFile: SourceFile,
    namedImport: string,
    moduleSpecifier: string
) {
    const existingImport = sourceFile.getImportDeclaration(
        (declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier
    );

    if (existingImport) {
        const hasNamedImport = existingImport
            .getNamedImports()
            .some((named) => named.getName() === namedImport);

        if (!hasNamedImport) {
            existingImport.addNamedImport(namedImport);
        }

        return;
    }

    sourceFile.insertImportDeclaration(0, {
        moduleSpecifier,
        namedImports: [namedImport],
    });
}

export function insertUseTranslations(
    sourceFile: SourceFile,
    namespace: string,
    options: InsertTranslationsOptions = {}
) {
    if (options.i18nLibrary === "paraglide-js" && options.import) {
        ensureNamedImport(sourceFile, options.import.named, options.import.source);
        return;
    }

    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (!defaultExport) return;

    const declarations = defaultExport.getDeclarations();
    if (declarations.length === 0) return;

    const decl = declarations[0];

    // Function Component tradicional
    if (decl.getKind() === SyntaxKind.FunctionDeclaration) {
        const body = decl.asKind(SyntaxKind.FunctionDeclaration)?.getBody();
        if (!body) return;

        if (!(body as Block).getVariableStatements().some(vs => vs.getDeclarations().some(d => d.getName() === "t"))) {
            (body as Block).insertVariableStatement(0, {
                declarationKind: VariableDeclarationKind.Const,
                declarations: [{ initializer: `useTranslations("${namespace}")`, name: "t" }],
            });
        }

        return;
    }

    // Arrow Function Component
    if (decl.getKind() === SyntaxKind.VariableDeclaration) {
        const initializer = (decl as VariableDeclaration).getInitializer();
        if (!initializer) return;

        // Si es arrow function
        if (initializer.getKind() === SyntaxKind.ArrowFunction) {
            const body = initializer.asKind(SyntaxKind.ArrowFunction)?.getBody();
            if (!body) return;

            // Si es un bloque {}
            if (body.getKind() === SyntaxKind.Block && !(body as Block).getVariableStatements().some(vs => vs.getDeclarations().some(d => d.getName() === "t"))) {
                (body as Block).insertVariableStatement(0, {
                    declarationKind: VariableDeclarationKind.Const, declarations: [{ initializer: `useTranslations("${namespace}")`, name: "t" }],
                });
            }

            (decl as VariableDeclaration).setInitializer(`() => { const t = useTranslations("${namespace}"); return ${body.getText()}; }`);
        }
    }
}
