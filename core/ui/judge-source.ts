/** Which lines "Judge these lines" opens on: the page that sent the person there sets it. */
export type JudgeSource = "named songs" | "look-back";
let source: JudgeSource = "named songs";
export const setJudgeSource = (s: JudgeSource) => void (source = s);
export const judgeSource = () => source;
