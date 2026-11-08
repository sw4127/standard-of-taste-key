/**
 * FR-CORE-2's register check, as word lists (T8.2). The lists are data copied from the live site's
 * `src/content/register.ts` and the Chinese lists it reads from `src/content/zh/guards.ts` (PRD
 * section 8), plus the two personality shapes the Stage 6 checks (`stage-6/s2/checks.py`) added for
 * this rebuild: a trait stated as fact.
 *
 * What it cannot do: read meaning. A pass means none of THESE words or shapes appears.
 */

/** Words that name a feeling or a state of mind. None may appear in a line the product states. */
export const FEELING_WORDS =
  /\b(sad|sadness|lonely|loneliness|alone|happy|happiness|angry|anger|stressed|stress|hurt|heartbr\w*|mourn\w*|afraid|fear\w*|joy\w*|longing|nostalgi\w*|melanchol\w*|feel\w*|mood\w*|emotion\w*|restless|numb|empty|hope\w*|hopeless\w*|calm\w*|comfort\w*|miss\w*|love\w*|lost)\b/i;

export const FEELING_WORDS_ZH =
  /难过|伤心|悲伤|孤独|寂寞|孤单|快乐|开心|高兴|愤怒|生气|压力|紧张|受伤|心碎|哀悼|害怕|恐惧|喜悦|怀念|怀旧|忧郁|感觉|感到|感受|情绪|心情|不安|麻木|空虚|希望|绝望|平静|安慰|想念|爱上|恋爱|迷失|失落/;

/** Shapes that assert something about the reader's inner life, or a trait, as fact. */
export const ASSERTIONS: readonly RegExp[] = [
  /\byou(?:'re| are| were| have been| seem| sound| must be)\s+(?:\w+\s+)?(?:sad|lonely|happy|angry|stressed|hurt|afraid|anxious|grieving|healing|nostalgic|restless|numb|empty|lost|in love|heartbroken|searching for)\b/i,
  /\byou (?:feel|felt|are feeling|have been feeling|need|needed|want|wanted|miss|missed)\b(?![^?]*\?)/i,
  /\b(?:this|that|it|which) (?:means|shows|proves|reveals|tells us|says) (?:that )?you\b/i,
  /\byou (?:clearly|obviously|definitely|certainly|must)\b/i,
  /\bdeep down\b/i,
  // Stage 6, for the rebuild: a trait stated as fact.
  /\byou(?:'re| are) (?:a|an|the) (?:\w+ )?(?:person|listener|soul|romantic|introvert|extrovert|dreamer|type)\b/i,
  /\byour (?:personality|character|soul|true self|inner)\b/i,
  /你(?:很|一定|肯定|显然|似乎|好像|想必)?(?:难过|孤独|快乐|愤怒|有压力|受伤|害怕|焦虑|悲伤|怀旧|不安|麻木|空虚|迷失|失落|心碎)/,
  /你(?:感到|觉得|感觉|需要|想要|想念)(?![^？]*？)/,
  /(?:这|那|它)(?:说明|意味着|表明|证明|揭示|告诉我们)了?你/,
  /你(?:显然|明显|肯定|一定|必然)/,
  /内心深处/,
];

/** Comparison with other people: there is no population behind any line. */
export const COMPARISON: readonly RegExp[] = [
  /\bpercentile\b/i,
  /\btop \d+%/i,
  /\b(?:most|many|few) (?:listeners|people|readers|users)\b/i,
  /\b(?:better|worse) than (?:average|most|others)\b/i,
  /\bcompared (?:to|with) (?:others|everyone|most)\b/i,
  /\bcohort\b/i,
  /\b(?:unusual|typical|normal|average) (?:listener|amount|for)\b/i,
  /百分位|分位数/,
  /前\s*\d+\s*%/,
  /(?:大多数|多数|许多|很多|少数)(?:听者|听众|人|读者|用户)/,
  /(?:比|高于|低于|优于|差于)(?:平均|大多数人|别人|其他人|多数人)/,
  /(?:与|和|跟)(?:他人|别人|其他人|大家|所有人)(?:相比|比)/,
  /同龄人|同类人群/,
  /(?:不寻常|典型|正常|普通|一般)的(?:听者|量)/,
  /超过了?\s*\d+\s*%\s*的/,
];

/** A story speaks of its own people, never to the reader. */
export const ADDRESSES_READER = /\byou\b|\byour\b|\byou'|你/i;
