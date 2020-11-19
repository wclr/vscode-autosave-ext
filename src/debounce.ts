import xs, { Stream } from 'xstream'
import delay from 'xstream/extra/delay'

/* 
Helper stream operator function that applies delay based debounce
to stream parts splitting it by supplied predicate rule.
 */
export const debounceBy = <T, B = any>(
  by: (val: T) => B,
  debounceDelay: number
) => {
  return (stream$: Stream<T>) => {
    return stream$
      .fold<{ delay: number; val: T; time: number }[]>((queue, val) => {
        const prev = queue.find((item) => by(item.val) === by(val))
        const queuedCleaned = queue.filter(
          (item) => item.delay > 0 && item !== prev
        )
        const time = new Date().getTime()

        return queuedCleaned
          .map((item) => ({
            ...item,
            delay: Math.max(0, debounceDelay - (time - item.time)),
          }))
          .concat({
            time,
            val,
            delay: debounceDelay,
          })
      }, [])
      .map((queue) => {
        return xs.merge(
          ...queue.map((item) =>
            item.delay > 0
              ? xs.of(item.val).compose(delay(item.delay))
              : xs.of(item.val)
          )
        )
      })
      .flatten()
  }
}
