/**
 * The RTS reels the reels demo plays: upright videos RTS published between
 * 2023 and 2025, each checked to resolve to a clear HLS stream that plays
 * abroad (2026-10-28). The page keeps them here rather than search for
 * them, so the feed does not change with the search. The stream URLs are
 * not kept: each playback needs a fresh token, which the SRG SSR connector
 * fetches when it resolves the URN.
 */

/** One reel: its URN, its title without the "Reel" RTS puts before it, its length, its picture. */
export interface Reel {
  readonly urn: string;
  readonly title: string;
  readonly seconds: number;
  readonly image: string;
}

export const REELS: readonly Reel[] = [
  {
    urn: 'urn:rts:video:15399819',
    title: 'Voix-off incendie Californie (sous titré et pas sous titré)',
    seconds: 43.7,
    image: 'https://img.rts.ch/medias/2025/image/3nxm5q-28748851.image/9x16',
  },
  {
    urn: 'urn:rts:video:15072104',
    title: 'Klaxon du Car Postal',
    seconds: 27.8,
    image: 'https://img.rts.ch/medias/2024/image/civd9s-28587906.image/9x16',
  },
  {
    urn: 'urn:rts:video:15072064',
    title: 'Hiver',
    seconds: 4.7,
    image: 'https://img.rts.ch/medias/2024/image/sekqdw-28587877.image/9x16',
  },
  {
    urn: 'urn:rts:video:14875981',
    title: 'Fitness',
    seconds: 58.6,
    image: 'https://img.rts.ch/medias/2024/image/adeapz-28488774.image/9x16',
  },
  {
    urn: 'urn:rts:video:14859582',
    title: 'Froid',
    seconds: 13.2,
    image: 'https://img.rts.ch/medias/2024/image/58ve3l-28480865.image/9x16',
  },
  {
    urn: 'urn:rts:video:14798072',
    title: 'Des cadeaux, des cadeaux !',
    seconds: 7.3,
    image: 'https://img.rts.ch/medias/2024/image/1fmd3p-28450685.image/9x16',
  },
  {
    urn: 'urn:rts:video:14553288',
    title: 'Trafic interrompu',
    seconds: 9.9,
    image: 'https://img.rts.ch/medias/2023/image/ukl427-27498201.image/9x16',
  },
  {
    urn: 'urn:rts:video:14553087',
    title: 'Parole de fossoyeur',
    seconds: 37.4,
    image: 'https://img.rts.ch/medias/2023/image/jxz4qq-27498705.image/9x16',
  },
  {
    urn: 'urn:rts:video:14553096',
    title: 'Pas le temps !',
    seconds: 30.8,
    image: 'https://img.rts.ch/medias/2023/image/tdso9h-27498632.image/9x16',
  },
  {
    urn: 'urn:rts:video:14513624',
    title: 'Alerte aux primes',
    seconds: 18.8,
    image: 'https://img.rts.ch/medias/2023/image/bo0kxu-27498767.image/9x16',
  },
  {
    urn: 'urn:rts:video:14513614',
    title: 'Les tamagotchis',
    seconds: 23.2,
    image: 'https://img.rts.ch/medias/2023/image/9setxq-27498755.image/9x16',
  },
  {
    urn: 'urn:rts:video:14513578',
    title: '15 ans de M2',
    seconds: 38.7,
    image: 'https://img.rts.ch/medias/2023/image/fc43kd-27498764.image/9x16',
  },
  {
    urn: 'urn:rts:video:14513587',
    title: 'Skateboard',
    seconds: 33.6,
    image: 'https://img.rts.ch/medias/2023/image/bj1oav-27498779.image/9x16',
  },
  {
    urn: 'urn:rts:video:14513557',
    title: "L'aspira-crotte à bouche",
    seconds: 36.4,
    image: 'https://img.rts.ch/medias/2023/image/351ffb-27498761.image/9x16',
  },
  {
    urn: 'urn:rts:video:14513536',
    title: "L'ivresse du boguet",
    seconds: 38.6,
    image: 'https://img.rts.ch/medias/2023/image/pvjwby-27498773.image/9x16',
  },
  {
    urn: 'urn:rts:video:14513304',
    title: 'Le Jeûne genevois ?',
    seconds: 17.6,
    image: 'https://img.rts.ch/medias/2023/image/68lten-27498790.image/9x16',
  },
  {
    urn: 'urn:rts:video:14493623',
    title: 'Breakdance Placette',
    seconds: 36.6,
    image: 'https://img.rts.ch/medias/2023/image/dy4vjr-27498788.image/9x16',
  },
  {
    urn: 'urn:rts:video:14493574',
    title: 'Rentrée scolaire 2001',
    seconds: 19.0,
    image: 'https://img.rts.ch/medias/2023/image/guzpjv-27498816.image/9x16',
  },
  {
    urn: 'urn:rts:video:14493560',
    title: 'Rahhh ces Genevois !',
    seconds: 6.4,
    image: 'https://img.rts.ch/medias/2023/image/3pqml4-27498812.image/9x16',
  },
  {
    urn: 'urn:rts:video:14493493',
    title: "La météo de l'été",
    seconds: 22.1,
    image: 'https://img.rts.ch/medias/2023/image/vj1awi-27498825.image/9x16',
  },
  {
    urn: 'urn:rts:video:14493503',
    title: 'Hop Suisse !',
    seconds: 7.9,
    image: 'https://img.rts.ch/medias/2023/image/b0viwr-27498823.image/9x16',
  },
  {
    urn: 'urn:rts:video:14493430',
    title: "Qui s'ennuie en vacances ?",
    seconds: 13.0,
    image: 'https://img.rts.ch/medias/2023/image/5qq675-27498833.image/9x16',
  },
  {
    urn: 'urn:rts:video:14493275',
    title: 'Le bronzage congolais',
    seconds: 38.5,
    image: 'https://img.rts.ch/medias/2023/image/9vs2yn-27498838.image/9x16',
  },
  {
    urn: 'urn:rts:video:14493241',
    title: "C'est quoi pour toi Paléo ?",
    seconds: 46.8,
    image: 'https://img.rts.ch/medias/2023/image/8zjydc-27498844.image/9x16',
  },
  {
    urn: 'urn:rts:video:14492686',
    title: 'Trop de bruit en ville ?',
    seconds: 7.6,
    image: 'https://img.rts.ch/medias/2023/image/h0awmz-27498871.image/9x16',
  },
  {
    urn: 'urn:rts:video:14552690',
    title: "Sagesse d'armailli",
    seconds: 11.6,
    image: 'https://img.rts.ch/medias/2023/image/9wqgia-27498933.image/9x16',
  },
];
