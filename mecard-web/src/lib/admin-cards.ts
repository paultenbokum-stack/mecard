// Card production for the staff screens (Toolset's Card Processing page).
// Pure, so it can be unit tested.

/** The production flags on a card, in workflow order, with the labels staff see. */
export const CARD_FLAGS = [
  ["designSubmitted", "Design submitted"],
  ["designReceived", "Design received"],
  ["printJobSetUp", "Print job set up"],
  ["printed", "Printed"],
  ["encoded", "Encoded"],
  ["packaged", "Packaged"],
  ["shipped", "Shipped"],
] as const;

export type CardFlag = (typeof CARD_FLAGS)[number][0];
export type CardFlags = Record<CardFlag, boolean>;

/** The flags staff tick on the list (the customer ticks "design submitted" by submitting). */
export const STAFF_FLAGS: CardFlag[] = ["designReceived", "printJobSetUp", "printed", "encoded", "packaged", "shipped"];

export const isCardFlag = (v: string): v is CardFlag => CARD_FLAGS.some(([k]) => k === v);

/** The furthest step reached, e.g. "Printed", or "Awaiting design". */
export function cardProgress(c: CardFlags): string {
  for (let i = CARD_FLAGS.length - 1; i >= 0; i--) if (c[CARD_FLAGS[i][0]]) return CARD_FLAGS[i][1];
  return "Awaiting design";
}

/** Card Processing tabs: where each card is in the workflow. */
export const CARD_STAGES = {
  todo: "To do",
  design: "Awaiting design",
  check: "Design to check",
  print: "To print",
  encode: "To encode",
  pack: "To package",
  ship: "To ship",
  done: "Shipped",
  all: "All",
} as const;

export type CardStage = keyof typeof CARD_STAGES;

/** Cards printed in house (custom and classic cards); key rings, phone tags and tags come ready-made. */
export const PRINT_TYPES = ["contactcard", "classiccard"];
/** Cards encoded from the encoding file (GoToTags). Key rings are encoded when they are made. */
export const ENCODE_TYPES = ["contactcard", "classiccard", "phonetag"];

/** Which step a card is waiting for (its Card Processing tab, besides To do and All). */
export function cardStage(c: CardFlags & { type: string }): Exclude<CardStage, "todo" | "all"> {
  if (c.shipped) return "done";
  if (c.packaged) return "ship";
  const prints = PRINT_TYPES.includes(c.type);
  if (prints && !c.designSubmitted) return "design";
  if (prints && !c.designReceived) return "check";
  if (prints && !c.printed) return "print";
  if (ENCODE_TYPES.includes(c.type) && !c.encoded) return "encode";
  return "pack";
}
