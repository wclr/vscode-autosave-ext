import vscode from 'vscode'
import t from 'assert'
import { makeEmitter } from '../emitter'
import { runAutoSaveExt } from '../run'

const timeout = (t: number) => new Promise((resolve) => setTimeout(resolve, t))

describe('runAutoSaveExt', () => {
  const { getEvents, emitEvent } = makeEmitter()
  const logMessages: string[] = []
  const savedDocs: vscode.TextDocument[] = []

  const lastLogMessage = () => logMessages[logMessages.length - 1]
  const lastSavedDoc = () => savedDocs[savedDocs.length - 1]
  const cleanSaved = () => savedDocs.splice(0, savedDocs.length)

  const getVscodeDoc = ({
    path,
    saveTimeout = 0,
  }: {
    path: string
    saveTimeout?: number
  }) => {
    const d = {
      uri: {
        fsPath: path,
      },
      save: () => {
        setTimeout(() => emitEvent('fileSaved', d), saveTimeout)
        savedDocs.push(d)
      },
    } as vscode.TextDocument
    return d
  }

  before(() => {
    runAutoSaveExt({
      getEvents,
      log: (...args) => {
        const msg = args.join(' ')
        logMessages.push(msg)
        // console.log(msg)
      },
    })
  })

  it('should enabled message if config is present', async () => {
    emitEvent('configChanged', {
      debounce: 100,
      extensions: ['.elm'],
    })
    t.ok(/enabled with settings/.test(lastLogMessage()))
  })

  it('should save changed file', async () => {
    emitEvent('configChanged', {
      debounce: 100,
      extensions: ['.elm'],
    })

    const d = getVscodeDoc({ path: '/some/path/file.elm' })
    emitEvent('fileChanged', d)
    await timeout(500)
    t.ok(/file saved/i.test(lastLogMessage()))
    t.ok(lastSavedDoc() === d)
  })

  it('should skip change of file that has not correct extension', async () => {
    emitEvent('configChanged', {
      debounce: 50,
      extensions: ['.elm'],
    })

    const d = getVscodeDoc({ path: '/some/path/file.js' })
    emitEvent('fileChanged', d)
    await timeout(150)

    t.ok(lastSavedDoc() !== d)
  })

  it('should save file only once on multiple changes (debounce setting)', async () => {
    emitEvent('configChanged', {
      debounce: 100,
      extensions: ['.elm'],
    })

    const d = getVscodeDoc({ path: '/some/path/file.elm' })

    cleanSaved()

    emitEvent('fileChanged', d)
    await timeout(10)
    emitEvent('fileChanged', d)
    await timeout(50)
    emitEvent('fileChanged', d)

    await timeout(200)
    t.strictEqual(savedDocs.length, 1)
  })

  it('should save two files changed in one moment', async () => {
    emitEvent('configChanged', {
      debounce: 50,
      extensions: ['.elm'],
    })

    const d1 = getVscodeDoc({ path: '/some/path/file1.elm' })
    const d2 = getVscodeDoc({ path: '/some/path/file2.elm' })

    cleanSaved()

    emitEvent('fileChanged', d1)
    await timeout(10)

    emitEvent('fileChanged', d2)
    await timeout(100)

    t.strictEqual(savedDocs.length, 2)
    t.strictEqual(savedDocs[0], d1)
    t.strictEqual(savedDocs[1], d2)
  })

  it('should skip save if new change event happens just after save', async () => {
    emitEvent('configChanged', {
      debounce: 50,
      extensions: ['.elm'],
    })

    const d = getVscodeDoc({ path: '/some/path/file.elm' })

    cleanSaved()

    emitEvent('fileChanged', d)
    await timeout(100)
    emitEvent('fileChanged', d)    
    await timeout(100)
    
    t.strictEqual(savedDocs.length, 1)
  })


  it('should output not enabled message if no config', () => {
    emitEvent('configChanged', null)
    t.ok(/not enabled/.test(lastLogMessage()))
    emitEvent('configChanged', null)
  })
})
