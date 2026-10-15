export type Category = 'stances' | 'punches' | 'strikes' | 'kicks' | 'blocks' | 'general';
export type Term = {
  id: string;
  name: string;
  kanji: string;
  category: Category;
  tag?: string;
  english: string;
  description: string;
  image: string | null;
  video?: string;
};
export type Direction = 'ja-en' | 'en-ja';
export type Rating = 'again' | 'remembered';
export type ReviewRecord = {
  stage: number;
  dueAt: number;
  attempts: number;
  remembered: number;
  lastReviewed: number;
  lastRating: Rating;
};
export type StudyProgress = {
  version: 1;
  records: Record<string, ReviewRecord>;
  savedIds: string[];
};
export type StudySet = { id: string; title: string; description: string; ids: string[] };
export type FlashSession = {
  queue: string[];
  index: number;
  retriedIds: string[];
  originalIds: string[];
  ratings: { id: string; rating: Rating }[];
};
export type QuizQuestion = { term: Term; options: Term[] };

// Explicit vocabulary group membership; these are not belt or grading requirements.
export const STUDY_SETS: StudySet[] = [
  { id: 'dojo', title: 'Inside the dōjō', description: 'Commands & etiquette',
    ids: ['general-35', 'general-36', 'general-37', 'general-38', 'general-39', 'general-40', 'general-41', 'general-42', 'general-43', 'general-44', 'general-45', 'general-46', 'general-47', 'general-48', 'general-49', 'general-50'] },
  { id: 'stances', title: 'Find your stance', description: 'Eight foundational stance names',
    ids: ['musubi-dachi', 'heiko-dachi', 'sanchin-dachi', 'neko-ashi-dachi', 'shiko-dachi', 'zenkutsu-dachi', 'kokutsu-dachi', 'tsuru-ashi-dachi'] },
  { id: 'hands', title: 'Hands & striking', description: 'Punches and strikes',
    ids: ['choku-zuki', 'oi-zuki', 'gyaku-zuki', 'kizami-zuki', 'mawashi-zuki', 'ura-zuki', 'uraken-uchi', 'shuto-uchi', 'haito-uchi', 'tettsui-uchi', 'empi-uchi', 'nukite'] },
  { id: 'kicks-blocks', title: 'Kicks & receiving', description: 'Kicks and blocks',
    ids: ['mae-geri', 'mawashi-geri', 'yoko-geri', 'ushiro-geri', 'hiza-geri', 'kansetsu-geri', 'kin-geri', 'age-uke', 'gedan-barai', 'soto-uke', 'uchi-uke', 'shuto-uke', 'mawashi-uke', 'kake-uke'] },
  { id: 'kata-concepts', title: 'Kata & core concepts', description: 'Names and ideas behind practice',
    ids: ['general-75', 'general-76', 'general-77', 'general-78', 'general-79', 'general-80', 'general-81', 'general-82', 'general-83', 'general-84', 'general-85', 'general-86', 'general-87', 'general-88', 'general-89', 'general-90', 'general-91', 'general-92', 'general-93', 'general-94', 'general-95', 'general-96', 'general-97', 'general-98', 'general-99', 'general-100', 'general-101', 'general-102'] },
];
