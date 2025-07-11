# Prettier Configuration Guide

## Overview
This project uses Prettier for consistent code formatting across all JavaScript files. The configuration follows modern best practices for Node.js projects.

## Configuration Details

### `.prettierrc` Settings Explained

```json
{
  "semi": true,                          // Always use semicolons
  "trailingComma": "es5",               // Trailing commas where valid in ES5
  "singleQuote": true,                   // Use single quotes instead of double
  "printWidth": 80,                      // Line length limit
  "tabWidth": 2,                         // 2 spaces for indentation
  "useTabs": false,                      // Use spaces, not tabs
  "bracketSpacing": true,                // Spaces inside object brackets
  "bracketSameLine": false,              // Put > on new line in JSX
  "arrowParens": "avoid",                // Avoid parens around single arrow function params
  "endOfLine": "lf",                     // Unix line endings
  "quoteProps": "as-needed",             // Only quote object props when needed
  "jsxSingleQuote": true,                // Single quotes in JSX
  "proseWrap": "preserve",               // Don't wrap markdown
  "htmlWhitespaceSensitivity": "css",    // Respect CSS whitespace rules
  "embeddedLanguageFormatting": "auto"   // Format embedded code
}
```

## Installation & Setup

### 1. Install Prettier
```bash
npm install --save-dev prettier
```

### 2. Available Scripts

```bash
# Format all files in the project
npm run format

# Check if files are formatted (useful for CI/CD)
npm run format:check

# Format only staged files (useful with git hooks)
npm run format:staged
```

### 3. IDE Integration

#### VS Code
1. Install the "Prettier - Code formatter" extension
2. Add to your VS Code settings (`.vscode/settings.json`):
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
}
```

#### WebStorm/IntelliJ
1. Go to Settings → Languages & Frameworks → JavaScript → Prettier
2. Set Prettier package path to `node_modules/prettier`
3. Check "On save" and "On code reformat"

### 4. Git Hooks (Optional)

For automatic formatting on commit, install husky and lint-staged:

```bash
npm install --save-dev husky lint-staged
```

Add to `package.json`:
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,css,md}": [
      "prettier --write"
    ]
  }
}
```

Setup husky:
```bash
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

## Usage Examples

### Before Prettier
```javascript
const express=require('express');
const app=express();

app.get('/api/users',(req,res)=>{
res.json({users:[{id:1,name:"John"},{id:2,name:"Jane"}]});
});

module.exports=app;
```

### After Prettier
```javascript
const express = require('express');
const app = express();

app.get('/api/users', (req, res) => {
  res.json({
    users: [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
    ],
  });
});

module.exports = app;
```

## Best Practices

1. **Run formatting before commits**: Always format your code before committing
2. **Team consistency**: Ensure all team members use the same Prettier version
3. **CI/CD integration**: Add `npm run format:check` to your CI pipeline
4. **Editor integration**: Set up your editor to format on save
5. **Ignore generated files**: Use `.prettierignore` to exclude auto-generated files

## Troubleshooting

### Common Issues

1. **Prettier not formatting**: Check if the file type is supported and not in `.prettierignore`
2. **Conflicts with ESLint**: Use `eslint-config-prettier` to disable conflicting rules
3. **Different formatting in CI**: Ensure same Prettier version across environments

### Debugging
```bash
# Check which files will be formatted
prettier --list-different .

# See what changes Prettier would make
prettier --check .

# Format specific file types only
prettier --write "**/*.{js,json}"
```

## Integration with This Project

This Node.js API project benefits from Prettier by:
- Consistent code style across all JavaScript files
- Improved readability for PDF processing and form generation code
- Better collaboration when multiple developers work on the codebase
- Reduced code review time spent on style discussions

Run `npm run format` after setting up to format all existing files according to the new configuration.