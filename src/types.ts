import vscode from 'vscode'
import { Stream } from 'xstream'

export type AutoSaveConfig = {
  debounce: number
  extensions?: string[]
  include?: string[]
  exclude?: string[]
  // glob: boolean
}

export type EventTypes = {
  fileChanged: vscode.TextDocument
  fileSaved: vscode.TextDocument
  configChanged: AutoSaveConfig | null
}

export type GetEvents = <T extends keyof EventTypes>(
  type: T
) => Stream<EventTypes[T]>
export type Log = (...args: string[]) => void
