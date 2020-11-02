import xs from 'xstream'
import { extname } from 'path'
import delay from 'xstream/extra/delay'
import sampleCombine from 'xstream/extra/sampleCombine'
import { debounceBy } from './debounce'
import { AutoSaveConfig, GetEvents, Log } from './types'

const testFilePath = (filePath: string, config: AutoSaveConfig) => {
  if (config.extensions.length) {
    const ext = extname(filePath)
    return config.extensions.includes(ext)
  }
  return true
}

export const runAutoSaveExt = ({
  getEvents,
  log,
}: {
  getEvents: GetEvents
  log: Log
}) => {
  const config$ = getEvents('configChanged')

  const docChanged$ = config$
    .map((config) => {
      if (!config) return xs.empty()

      const docSaved$ = getEvents('fileSaved')
        .filter((doc) => testFilePath(doc.uri.fsPath, config))
        .map((d) => {
          return xs.merge(xs.of(d), xs.of(null).compose(delay(500)))
        })
        .flatten()
        .startWith(null)
        .debug((d) => d && log('File saved:', d.uri.fsPath))

      return getEvents('fileChanged')
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

  docChanged$.addListener({
    next: (d) => {
      log('Saving changed file:', d.uri.fsPath)
      d.save()
    },
  })

  config$.addListener({
    next: (config) => {
      if (config) {
        log(
          'Autosave enabled with settings:\n',
          JSON.stringify(config, null, 2)
        )
      } else {
        log('Autosave is not enabled in this workspace.')
      }
    },
  })
}
