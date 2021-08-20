# AutoSaveExt VSCode Extension

> VSCode extension for advanced autosave feature configuration.

This extension allows to have custom configuration of autosave feature for specified types of files because standard editor's `autoSave` option is applied to all file types and languages.

## Settings

Extension loads config from standard settings (project's `.vscode/settings.json` or .global user settings). 

Case you do not define a configuration, autosave will be applied to all files

This option is not language specific, so just add file extensions that should be a subject for autosave.

Supported config:

```json5
{
  "autoSaveExt": {
    "debounce": 1000, // default is 500
    "extensions": [".elm", ".ts"]
  }
}
```

You also he can specify a subject for autosave with include and exclude using glob patterns

```json5
{
  "autoSaveExt": {
    "extensions": [".ts"],
    "include": ["*.test.jsx", "*.config*"],
    "exclude": ["*.component.ts", "*.service.ts"],
  }
}
```

## Issues

If you have proposal or issue. Add an issue with description of your case.

### Unreleased

Initial release of unreleased yet.
