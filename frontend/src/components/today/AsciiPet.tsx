import { useState, useEffect, useRef } from 'react'

// Простой классический мини-кот
// /\_/\
// (o.o)
//  > ^ <

// Только глаза меняются: [лево, право, пауза мс]
const FACES: [string, string, number][] = [
  ['o', 'o',    0],   // idle
  ['-', '-',  140],   // моргание
  ['^', '^',  800],   // радость
  ['O', 'O',  350],   // удивление
  ['*', '*',  600],   // восторг
  ['o', '-',  700],   // подмигивание
]

// моргание чаще всего
const POOL = [1,1,1,1, 2, 3, 4, 5]

interface Props {
  tip: string | null
  isLoading: boolean
}

export default function AsciiPet({ tip, isLoading }: Props) {
  const [idx, setIdx] = useState(0)
  const idle = useRef(true)

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    function tick() {
      if (!idle.current) {
        const [,,pause] = FACES[idx]
        t = setTimeout(() => { idle.current = true; setIdx(0); tick() }, pause || 200)
      } else {
        t = setTimeout(() => {
          idle.current = false
          setIdx(POOL[Math.floor(Math.random() * POOL.length)])
          tick()
        }, 2000 + Math.random() * 3000)
      }
    }
    tick()
    return () => clearTimeout(t)
  }, [idx])

  const [l, r] = FACES[idx]

  return (
    <div className="select-none">
      <div className="flex justify-center">
        <pre
          className="font-mono text-gray-400 dark:text-gray-500"
          style={{ fontSize: '15px', lineHeight: '1.1', fontWeight: 'bold' }}
        >{`/\\_/\\\n(${l}.${r})\n> ^ <`}</pre>
      </div>

      {(isLoading || !!tip) && (
        <div className="mt-2">
          <div className="flex justify-center -mb-px">
            <div className="w-2 h-2 bg-gray-100 dark:bg-gray-700 border-l border-t border-gray-200 dark:border-gray-600 rotate-45" />
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5">
            {isLoading ? (
              <div className="flex gap-1 py-0.5">
                {[0, 130, 260].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            ) : (
              <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{tip}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
