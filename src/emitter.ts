import fromEvent from 'xstream/extra/fromEvent'
import { EventEmitter } from 'events'

import { EventTypes } from './types'

export const makeEmitter = () => {
  const wsEmitter = new EventEmitter()
  const emitEvent = <T extends keyof EventTypes>(
    type: T,
    data: EventTypes[T]
  ) => {
    wsEmitter.emit(type, data)
  }
  const getEvents = <T extends keyof EventTypes>(type: T) =>
    fromEvent<EventTypes[T]>(wsEmitter, type)
  return { emitEvent, getEvents }
}
