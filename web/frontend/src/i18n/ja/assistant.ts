// Aggregator for the assistant namespace — split into ./assistant/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import assistantPart1 from "./assistant/part1";
import assistantPart2 from "./assistant/part2";
import assistantPart3 from "./assistant/part3";

const assistant = { ...assistantPart1, ...assistantPart2, ...assistantPart3 } as const;

export default assistant;
