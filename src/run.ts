import xs from 'xstream'
import { basename, extname } from 'path'
import delay from 'xstream/extra/delay'
import sampleCombine from 'xstream/extra/sampleCombine'
import { debounceBy } from './debounce'
import { AutoSaveConfig, GetEvents, Log } from './types'
import globToRegExp from 'glob-to-regexp';

const testGlob = (config: string[], fileName: string) => {
  let patternFound = false;
  for (var i = 0; i < config.length; i++) {
    if (globToRegExp(config[i]).test(fileName)) {
      patternFound = true;
      break;
    }
  }
  return patternFound;
}

const testFilePath = (filePath: string, config: AutoSaveConfig) => {
  const fileExt = extname(filePath);
  const fileName = basename(filePath);
  let saveFile;

  if (config?.extensions?.length && !config?.include?.length)
    saveFile = config?.extensions.includes(fileExt)

  if (config?.include?.length)
    saveFile = testGlob(config.include, fileName)

  if (config?.exclude?.length && testGlob(config.exclude, fileName))
    saveFile = false

  if (saveFile === undefined) return true;

  return saveFile;
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
