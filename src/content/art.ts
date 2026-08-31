/* THE PLATES — image paths stay relative because this site deploys under /home/. */
const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`

export type Plate = {
  id: string
  src: string
  w: number
  h: number
  alt: string
  kana: string
  tone: 1 | 2 | 3 | 4 | 5
}

export const SCENES: Plate[] = [
  { id: 'kiss-neon', src: asset('art/kiss-neon.webp'), w: 1280, h: 679, alt: 'Two women in profile, one pink-haired with her eyes shut, one blonde, a breath apart', kana: '接吻', tone: 2 },
  { id: 'kiss-close', src: asset('art/kiss-close.webp'), w: 800, h: 406, alt: 'The same two, much closer — pink hair and blonde, sparks behind them', kana: '間近', tone: 2 },
  { id: 'kiss-window', src: asset('art/kiss-window.webp'), w: 1280, h: 668, alt: 'Two women kissing in front of a bright window, one dark-haired, one pink-haired', kana: '朝', tone: 4 },
  { id: 'kiss-water', src: asset('art/kiss-water.webp'), w: 1120, h: 1037, alt: 'Two women in green swimsuits on a ring in bright water, kissing, hands on each other’s faces', kana: '水', tone: 3 },
  { id: 'kiss-dark', src: asset('art/kiss-dark.webp'), w: 800, h: 450, alt: 'Two women kissing with their eyes shut, one dark-haired, one blonde', kana: '密', tone: 5 },
  { id: 'kiss-butterfly', src: asset('art/kiss-butterfly.webp'), w: 1026, h: 1410, alt: 'Two women in headphones with butterfly wings on the ear cups, teal-haired and pink-haired, foreheads together', kana: '蝶', tone: 4 },
  { id: 'kiss-mirror', src: asset('art/kiss-mirror.webp'), w: 1200, h: 849, alt: 'Two women close together, one holding a mirror, the other holding a makeup brush to her face', kana: '化粧', tone: 2 },
  { id: 'kiss-blush', src: asset('art/kiss-blush.webp'), w: 348, h: 345, alt: 'Two women in school uniforms, hands clasped together, both blushing, close', kana: '照', tone: 1 },
  { id: 'kiss-uniform', src: asset('art/kiss-uniform.webp'), w: 620, h: 889, alt: 'Two women in school uniforms, one holding the other’s face, about to kiss', kana: '制服', tone: 5 },
  { id: 'kiss-hearts', src: asset('art/kiss-hearts.webp'), w: 120, h: 120, alt: 'Two women in school uniforms holding hands and leaning close, surrounded by floating hearts', kana: '恋', tone: 1 },
  { id: 'kiss-neon-gaze', src: asset('art/kiss-neon-gaze.webp'), w: 90, h: 120, alt: 'Two women facing each other at extremely close range in pink and violet light', kana: '光', tone: 2 },
  { id: 'kiss-garden', src: asset('art/kiss-garden.webp'), w: 120, h: 120, alt: 'Two women kissing in a sunlit green park, each wearing flowers in her hair', kana: '庭', tone: 3 },
]

export const sceneById = (id: string) => SCENES.find((s) => s.id === id) as Plate
export const SCENE_ORDER: string[] = SCENES.map((s) => s.id)

export type Photo = Plate & {
  title: string
  stamp: string
  quote: string
  note: string
  href: string
  hrefLabel: string
}

export const ALLY: Photo[] = [
  {
    id: 'top8', src: asset('ally/top8.jpg'), w: 800, h: 800, alt: 'Ally Lubin, from the 2008 scene internet', kana: '〇八', tone: 2,
    title: 'THE HANDLE', stamp: '2008 — AND ON THE RECORD AGAIN IN 2026', quote: '“I peaked in 2008.”',
    note: 'Said about herself, unprompted, eighteen years later, and filed as corroboration by a man who had spent those eighteen years saying the same thing about her in longer sentences. The handle was famous enough that two grown men later treated it as an accredited institution — “i sent my transcripts to ALU, but got a rejection letter in the mail.”', href: '/arcade/alu-08', hrefLabel: 'PLAY ALU ’08',
  },
  {
    id: 'personal', src: asset('ally/personal.jpg'), w: 800, h: 800, alt: 'Ally Lubin, deadpan', kana: '個人', tone: 1,
    title: 'THE SHARPEST SENTENCE IN THE FILE', stamp: 'OCTOBER 30, 2023', quote: '“Well I do. It’s personal lol.”',
    note: 'He had just explained, at length, that his terrible response record was structural rather than about her — that he could refer her to his mother for confirmation. She declined the exemption in six words. He did not have an answer then and does not have one now.', href: '/arcade/courtship', hrefLabel: 'PLAY THE SCENE',
  },
  {
    id: 'dunkies', src: asset('ally/dunkies.jpg'), w: 800, h: 800, alt: 'Ally Lubin, the morning of August 19 2026', kana: '珈琲', tone: 5,
    title: 'THE FIRST MORNING IN SEVENTEEN YEARS', stamp: 'AUGUST 19, 2026 · 7:24 AM', quote: '“Good morning my queen. What do you want from dunkies?”',
    note: 'Seventeen years of bursts and silences, and this is the first time the channel had ever carried a morning. Iced, large, not weather-dependent. The coffee is incidental; being brought one is the entire mechanism.', href: '/brain/people/ally-lubin', hrefLabel: 'READ THE ENTRY',
  },
  {
    id: 'cats', src: asset('ally/cats.jpg'), w: 800, h: 800, alt: 'Ally Lubin with the cats, and the shelf', kana: '猫', tone: 3,
    title: 'TWO CATS, ONE SHELF', stamp: 'ONGOING · NIGHTLY', quote: 'Sylvia, named like a poet, behaving like a cat.',
    note: 'Edgar is all black, broad, unhurried — a wide paddle and slow hands. Sylvia is a tuxedo with a white bib and four white socks: narrow, fast, and the reason nothing stays on a shelf. There is a cabinet in the arcade that is only about this.', href: '/arcade/yarn', hrefLabel: 'CLEAR THE SHELF',
  },
  {
    id: 'deal', src: asset('ally/deal.jpg'), w: 800, h: 800, alt: 'Ally Lubin, the night the offer was accepted', kana: '契約', tone: 1,
    title: 'THE OFFER, ACCEPTED', stamp: 'AUGUST 18, 2026 · 11:49 PM', quote: '“Okay deal. Sounds good 1-2-3 break.”',
    note: 'Said with a straight face on a Tuesday night, after reading four thousand words about herself and coming back with notes. Vancouver or Burlington or Boulder; nobody involved is going to Boulder. The title went onto the infobox and it is load-bearing.', href: '/brain/people/ally-lubin', hrefLabel: 'THE INFOBOX',
  },
]

export const KISS_FACES = {
  back: asset('art/face-back.webp'),
  front: asset('art/face-front.webp'),
}
