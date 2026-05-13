export const INPUT_LIMITS = {
  search: 100,
  name: 100,
  idCode: 64,
  contactName: 80,
  contactMethod: 50,
  contactValue: 254,
  url: 2048,
  shortText: 255,
  note: 1000,
  longText: 2000,
  techRawInfo: 4000,
} as const;

export type TextLimitField = {
  label: string;
  value: unknown;
  max: number;
};

export type TextLimitViolation = TextLimitField & {
  current: number;
};

export const getTextLength = (value: unknown) => Array.from(String(value ?? '')).length;

export const findTextLimitViolation = (fields: TextLimitField[]): TextLimitViolation | null => {
  const violation = fields
    .map((field) => ({
      ...field,
      current: getTextLength(field.value),
    }))
    .find((field) => field.current > field.max);

  return violation || null;
};

export const formatTextLimitWarning = (violation: TextLimitViolation) => (
  `${violation.label}最多支持${violation.max}字符，当前已输入${violation.current}字符，请精简后再提交。`
);

export const showTextLimitWarning = (
  warn: (content: string) => unknown,
  fields: TextLimitField[],
) => {
  const violation = findTextLimitViolation(fields);
  if (!violation) return false;
  warn(formatTextLimitWarning(violation));
  return true;
};
