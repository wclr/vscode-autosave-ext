// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import vscode from 'vscode'
import { extname } from 'path'
import xs, { Stream } from 'xstream'
import fromEvent from 'xstream/extra/fromEvent'
import delay from 'xstream/extra/delay'
import sampleCombine from 'xstream/extra/sampleCombine'
import { debounceBy } from './debounce'

import { EventEmitter } from 'events'

type AutoSaveConfig = {
  debounce: number
  extensions: string[]
  // include: string[]  // not implemented
  // exclude: string[]  // not implemented
  // glob: boolean
}

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

const testFilePath = (filePath: string, config: AutoSaveConfig) => {
  if (config.extensions.length) {
    const ext = extname(filePath)
    return config.extensions.includes(ext)
  }
  return true
}

type EventTypes = {
  fileChanged: vscode.TextDocument
  fileSaved: vscode.TextDocument
  configChanged: AutoSaveConfig | null
}

const eventTypes: { [K in keyof EventTypes]: string } = {
  fileChanged: 'fileChanged',
  fileSaved: 'fileSaved',
  configChanged: 'configChanged',
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
// https://code.visualstudio.com/api/references/activation-events
// AutoSaveExt extension is activated onStartupFinished
export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel(outputChannelName)
  const log = (...args: string[]) => {
    output.appendLine(args.join(' '))
  }

  const wsEmitter = new EventEmitter()
  const emitEvent = <T extends keyof EventTypes>(
    type: T,
    data: EventTypes[T]
  ) => {
    wsEmitter.emit(type, data)
  }

  const getEvents = <T extends keyof EventTypes>(type: T) => {
    return fromEvent<EventTypes[T]>(wsEmitter, type)
  }

  const config$ = getEvents('configChanged')
  const docChanged$ = getEvents('fileChanged')
  const docSaved$ = getEvents('fileSaved')

  config$
    .debug((config) => {
      if (config) {
        log(
          'Autosave enabled with settings:\n',
          JSON.stringify(config, null, 2)
        )
      } else {
        log('Autosave is not enabled in this workspace.')
      }
    })
    .map((config) => {
      if (!config) return xs.empty()

      docSaved$
        .filter((doc) => testFilePath(doc.uri.fsPath, config))
        .map((d) => {
          return xs.merge(xs.of(d), xs.of(null).compose(delay(500)))
        })
        .flatten()
        .startWith(null)
        .debug((d) => d && log('File saved:', d.uri.fsPath))

      return docChanged$
        .filter((doc) => testFilePath(doc.uri.fsPath, config))
        .compose(debounceBy((_) => _, config.debounce))
        .debug((d) => log('changed after debounce', d.uri.fsPath))
        .compose(sampleCombine(docSaved$))
        .debug(([d1, d2]) =>
          log('changed', d1.uri.fsPath, 'last saved', d2?.uri.fsPath || 'null')
        )
        .filter(([d, lastSaved]) => d.uri.fsPath !== lastSaved?.uri.fsPath)
        .map(([d]) => d)
        .debug((d) => log('changed pass', d.uri.fsPath))
    })
    .flatten()
    .addListener({
      next: (d) => {
        log('Saving changed file:', d.uri.fsPath)
        d.save()
      },
    })

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

  getConfig()
}

// this method is called when your extension is deactivated
export function deactivate() {}
