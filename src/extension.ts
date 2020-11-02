// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import vscode from 'vscode'

import { AutoSaveConfig } from './types'
import { runAutoSaveExt } from './run'
import { makeEmitter } from './emitter'

const defaultConfig: AutoSaveConfig = {
  debounce: 500,
  extensions: [],
  // include: [],
  // exclude: [],
  // glob: false
}

const outputChannelName = 'AutoSaveExt'

const decodeConfig = (val: Partial<AutoSaveConfig>): AutoSaveConfig => {
  return {
    debounce:
      typeof val.debounce === 'number' && val.debounce > 0
        ? val.debounce
        : defaultConfig.debounce,
    extensions: (val.extensions || []).map((val) => '.' + val.replace('.', '')),
    // include: val.include || [],
    // exclude: val.exclude || [],
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
// https://code.visualstudio.com/api/references/activation-events
// AutoSaveExt extension is activated onStartupFinished
export function activate(context: vscode.ExtensionContext) {
  const { getEvents, emitEvent } = makeEmitter()

  vscode.workspace.onDidSaveTextDocument((document) => {
    emitEvent('fileSaved', document)
  })
  vscode.workspace.onDidChangeTextDocument(({ document }) => {
    emitEvent('fileChanged', document)
  })

  const getConfig = () => {
    const settingConfig = vscode.workspace
      .getConfiguration()
      .get('autoSaveExt') as Partial<AutoSaveConfig> | undefined

    const configVal: AutoSaveConfig | null = settingConfig
      ? decodeConfig(settingConfig)
      : null
    emitEvent('configChanged', configVal)
  }

  const disposable = vscode.commands.registerCommand(
    'autoSaveExt.reloadConfig',
    () => {
      getConfig()
    }
  )

  context.subscriptions.push(disposable)

  const output = vscode.window.createOutputChannel(outputChannelName)

  runAutoSaveExt({
    getEvents,
    log: (...args) => {
      output.appendLine(args.join(' '))
    },
  })

  getConfig()
}

// this method is called when your extension is deactivated
export function deactivate() {}
