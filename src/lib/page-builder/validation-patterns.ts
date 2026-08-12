export const VALIDATION_PATTERN_PRESETS = [
  {
    value: 'ph_mobile',
    label: 'Philippine mobile number',
    pattern: '^(?:\\+63|0)9\\d{9}$',
    example: '09171234567 or +639171234567',
  },
  {
    value: 'international_phone',
    label: 'International phone (E.164)',
    pattern: '^\\+[1-9]\\d{7,14}$',
    example: '+639171234567',
  },
  {
    value: 'digits',
    label: 'Digits only',
    pattern: '^\\d+$',
    example: '123456',
  },
  {
    value: 'whole_number',
    label: 'Whole number',
    pattern: '^-?\\d+$',
    example: '-12 or 450',
  },
  {
    value: 'decimal_number',
    label: 'Whole or decimal number',
    pattern: '^-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)$',
    example: '12, -12.5, or .75',
  },
] as const

export type ValidationPatternPreset = typeof VALIDATION_PATTERN_PRESETS[number]['value'] | 'none' | 'custom'

export function validationPatternPreset(pattern: string | null | undefined): ValidationPatternPreset {
  if (!pattern) return 'none'
  return VALIDATION_PATTERN_PRESETS.find((preset) => preset.pattern === pattern)?.value ?? 'custom'
}

export function validationPatternExample(pattern: string | null | undefined): string | null {
  return VALIDATION_PATTERN_PRESETS.find((preset) => preset.pattern === pattern)?.example ?? null
}

export function validationPatternIsPhone(pattern: string | null | undefined): boolean {
  const preset = validationPatternPreset(pattern)
  return preset === 'ph_mobile' || preset === 'international_phone'
}

export function isValidValidationPattern(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}
