/**
 * Список персон-котов. Зеркально совпадает с
 * `backend-node/src/llm/prompts/pet-personas.prompt.ts`. Если там добавится
 * новый кот — продублировать сюда (порядок и id критичны для карусели).
 *
 * Используется:
 * - PersonaPicker — рендер карусели и сопоставление selectedId → idx
 * - useDailyTip   — оптимистичное обновление persona на клике (сначала
 *                   меняем UI, потом дожидаемся ответа LLM)
 */
export interface PersonaInfo {
  id: string
  name: string
  eyes_l: string
  eyes_r: string
}

export const PERSONAS: PersonaInfo[] = [
  { id: 'suhar',    name: 'Сухарь',   eyes_l: '¬', eyes_r: '¬' },
  { id: 'valeryan', name: 'Валерьян', eyes_l: '°', eyes_r: '°' },
  { id: 'blin',     name: 'Блин',     eyes_l: '-', eyes_r: '-' },
  { id: 'shprot',   name: 'Шпрот',    eyes_l: '•`', eyes_r: '^•' },
  { id: 'plyushka', name: 'Плюшка',   eyes_l: '◡', eyes_r: '◡' },
  { id: 'marquis',  name: 'Маркиз',   eyes_l: '=', eyes_r: '=' },
  { id: 'lazer',    name: 'Лазер',    eyes_l: '>', eyes_r: '<' },
]

export function getPersonaInfo(id: string): PersonaInfo | undefined {
  return PERSONAS.find((p) => p.id === id)
}
