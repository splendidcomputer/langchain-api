## Undrstanding The TypeScript Compiler

To install the TypeScript compiler, use the following command:

```bash
sudo npm install -g typescript
```

To check the version of the installed TypeScript compiler, use this command:

```bash
tsc -v
```

## First Example in TypeScript

Create a TypeScript file (`index.ts`) with the following content:

```typescript
console.log("Hello World");
```

Then, compile the TypeScript file using the following command in the terminal:

```bash
tsc index.ts
```

## Configuring the TypeScript Compiler

To initialize the TypeScript compiler, execute the following command in your terminal:

```bash
tsc --init
```

This will create a `tsconfig.json` file. In this file, make the following modifications:

1. Under the `/* Language and Environment */` section, ensure that
   1. `"target": "ES2016"`.
2. Under the `/* Modules */` section, ensure that
   1. `"rootDir": "./src"`.
3. Under the `/* Emit */` section, ensure that
   1. `"outDir": "./dist"`.
   2. If also uncomment `"removeComments": true` then the TS compliter will not transfer the comments that we had is our TS code into to the generated JS code.
   3. Another useful setting is `"noEmitOnError": true ` which disables emitting files if any type checking errors are reported.
4.
