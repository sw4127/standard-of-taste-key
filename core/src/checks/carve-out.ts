/**
 * FR-CORE-2's carve-out check, as one word list in two languages (T8.2, rule 3). Data copied from the
 * live site's `src/content/carve-out.ts` and the Chinese list it joins from `src/content/zh/guards.ts`.
 * Nothing about trauma, abuse, self-harm or mental health is shown, whoever wrote the words: a song
 * title or an artist's name included.
 *
 * What it cannot do: judge a sentence that makes the claim in words not listed here.
 */
export const CARVE_OUT_PATTERNS: readonly RegExp[] = [
  /\b(?:trauma|traumatic|traumatis(?:ed|ing))\b/i,
  /\b(?:abuse|abused|abusive)\b/i,
  /\b(?:depress(?:ed|ion|ive)?|anxiety|anxious|ptsd|adhd|autis(?:m|tic)|neurodiverg(?:ent|ence))\b/i,
  /\bmental[- ]health\b/i,
  /\byour (?:childhood|loss)\b/i,
  /\bgrie(?:f|ving)\b/i,
  /\bunresolved\b/i,
  /\b(?:therapy|therapies|therapist|therapeutic|counsell?ing|counsell?or|psychiatr\w*|psychotherap\w*)\b/i,
  /\b(?:clinical(?:ly)?|disorder|medicat(?:ed|ion)|self[- ]harm|suicid\w*)\b/i,
  /创伤/,
  /虐待|施虐|受虐/,
  // 忧郁症 added in this build (2026-11-08): a common name for depression the copied list missed.
  /抑郁|忧郁症|焦虑|创伤后应激|多动症|自闭|孤独症|神经多样/,
  /心理健康|精神健康|心理疾病|精神疾病/,
  /你的(?:童年|失去|丧失)/,
  /悲痛|哀伤|丧亲|哀悼/,
  /未解决|未化解/,
  /治疗|疗愈|心理咨询|咨询师|心理医生|精神科|心理治疗/,
  /临床|心理障碍|精神障碍|进食障碍|睡眠障碍|药物|服药|自伤|自残|自杀|轻生/,
];
