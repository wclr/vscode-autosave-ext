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

  const getTextDoc = ({
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
  beforeEach(() => {
    cleanSaved()
  })

  it('should show enabled message if config is present', async () => {
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

    const d = getTextDoc({ path: '/some/path/file.elm' })
    emitEvent('fileChanged', d)
    await timeout(200)

    t.ok(/file saved/i.test(lastLogMessage()))
    t.ok(lastSavedDoc() === d)
  })

  it('should skip change of file that has not correct extension', async () => {
    emitEvent('configChanged', {
      debounce: 50,
      extensions: ['.elm'],
    })

    const d = getTextDoc({ path: '/some/path/file.js' })
    emitEvent('fileChanged', d)
    await timeout(150)

    t.ok(lastSavedDoc() !== d)
  })

  it('should save file only once on multiple changes (debounce setting)', async () => {
    emitEvent('configChanged', {
      debounce: 100,
      extensions: ['.elm'],
    })

    const d = getTextDoc({ path: '/some/path/file.elm' })

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

    const d1 = getTextDoc({ path: '/some/path/file1.elm' })
    const d2 = getTextDoc({ path: '/some/path/file2.elm' })

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

    const d = getTextDoc({ path: '/some/path/file.elm' })

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

  it('should save changed file using config include', async () => {
    emitEvent('configChanged', {
      debounce: 100,
      extensions: ['.js'],
      include: ['*.spec.elm'],
    })

    const d = getTextDoc({ path: '/some/path/file.spec.elm' })
    emitEvent('fileChanged', d)
    await timeout(200)

    t.ok(/file saved/i.test(lastLogMessage()))
    t.ok(lastSavedDoc() === d)
  })

  it('should skip change of file that has not correct pattern', async () => {
    emitEvent('configChanged', {
      debounce: 50,
      include: ['*.spec.elm'],
    })

    const d = getTextDoc({ path: '/some/path/file.test.elm' })
    emitEvent('fileChanged', d)
    await timeout(150)

    t.ok(lastSavedDoc() !== d)
  })

  it('should skip change of file that has correct extension, but has match on exclude config', async () => {
    emitEvent('configChanged', {
      debounce: 50,
      extensions: ['.elm'],
      exclude: ['*.test.elm'],
    })

    const d = getTextDoc({ path: '/some/path/file.test.elm' })
    emitEvent('fileChanged', d)
    await timeout(150)

    t.ok(lastSavedDoc() !== d)
  })

  it('should save changed file that has correct extension when config exclude is enabled but does has not matchs', async () => {
    emitEvent('configChanged', {
      debounce: 50,
      extensions: ['.elm'],
      exclude: ['*.test.elm'],
    })

    const d = getTextDoc({ path: '/some/path/file.elm' })
    emitEvent('fileChanged', d)
    await timeout(150)

    t.ok(lastSavedDoc() === d)
  })

  it('should skip change of file that has correct pattern, but has match on exclude config', async () => {
    emitEvent('configChanged', {
      debounce: 50,
      include: ['*.elm'],
      exclude: ['*.test.elm'],
    })

    const d = getTextDoc({ path: '/some/path/file.test.elm' })
    emitEvent('fileChanged', d)
    await timeout(150)

    t.ok(lastSavedDoc() !== d)
  })

  it('should save changed file using config include when config exclude is enabled but does has not match (glob)', async () => {
    emitEvent('configChanged', {
      debounce: 50,
      extensions: ['.js'],
      include: ['*.elm'],
      exclude: ['*.test.elm'],
    })

    const d = getTextDoc({ path: '/some/path/file.spec.elm' })
    emitEvent('fileChanged', d)
    await timeout(150)

    t.ok(lastSavedDoc() === d)
  })
})
