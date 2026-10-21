// src/theme/inputValidators.ts
/**
 * ==============================================================================
 * Centralized Input Syntax Validators & Sanitizers
 * Enforces Azure Resource Manager (ARM), Azure Policy, and CAF constraints.
 * ==============================================================================
 */

export interface ValidationResult<T = any> {
  valid: boolean;
  sanitized: T;
  errors: string[];
  warnings: string[];
}

/**
 * Azure Tag Key Restrictions:
 * - Length: 1 to 512 characters.
 * - Cannot contain: < > % & \ ? / or ASCII control characters.
 * - Cannot start with reserved prefix 'microsoft' or 'azure' unless permitted.
 */
export const AZURE_DISALLOWED_TAG_CHARS_REGEX = /[<>%&\\?/\x00-\x1F\x7F]/;
export const AZURE_DISALLOWED_TAG_CHARS_GLOBAL_REGEX = /[<>%&\\?/\x00-\x1F\x7F]/g;

export function validateTagKey(key: string): ValidationResult<string> {
  const trimmed = (key || '').trim();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!trimmed) {
    errors.push('Tag name cannot be empty.');
  }

  if (trimmed.length > 512) {
    errors.push(`Tag name exceeds Azure maximum limit of 512 characters (${trimmed.length} chars).`);
  }

  if (AZURE_DISALLOWED_TAG_CHARS_REGEX.test(trimmed)) {
    errors.push('Tag name contains invalid Azure characters. Characters < > % & \\ ? / are strictly forbidden.');
  }

  if (/^(microsoft|azure|windows)/i.test(trimmed)) {
    warnings.push('Tag name starts with a reserved cloud provider prefix (microsoft, azure, windows).');
  }

  const sanitized = trimmed.replace(AZURE_DISALLOWED_TAG_CHARS_GLOBAL_REGEX, '');

  return {
    valid: errors.length === 0,
    sanitized,
    errors,
    warnings,
  };
}

/**
 * Azure Tag Allowed Values:
 * - Comma-separated or Array of strings.
 * - Length per value: 0 to 256 characters.
 * - Cannot contain invalid characters: < > % & \ ? /
 * - Overload threshold: Warn if total allowed values > 50 (risks exceeding Azure Policy parameter limits).
 */
export function validateTagAllowedValues(input: string | string[]): ValidationResult<string[]> {
  const rawList: string[] = Array.isArray(input)
    ? input
    : (input || '')
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

  const errors: string[] = [];
  const warnings: string[] = [];
  const sanitizedList: string[] = [];
  const seen = new Set<string>();

  for (const rawVal of rawList) {
    const val = rawVal.trim();
    if (!val) continue;

    // Check duplicate
    const lower = val.toLowerCase();
    if (seen.has(lower)) {
      warnings.push(`Duplicate tag value '${val}' detected (automatically deduplicated).`);
      continue;
    }
    seen.add(lower);

    // Check illegal chars
    if (AZURE_DISALLOWED_TAG_CHARS_REGEX.test(val)) {
      errors.push(`Value '${val}' contains illegal Azure characters (< > % & \\ ? /).`);
    }

    // Check length
    if (val.length > 256) {
      errors.push(`Value '${val}' exceeds Azure limit of 256 characters (${val.length} chars).`);
    }

    const cleanVal = val.replace(AZURE_DISALLOWED_TAG_CHARS_GLOBAL_REGEX, '');
    if (cleanVal.length > 0) {
      sanitizedList.push(cleanVal);
    }
  }

  if (sanitizedList.length > 50) {
    warnings.push(
      `Allowed values count (${sanitizedList.length}) is high. Azure Policy parameter payload limits may be impacted if > 50 items.`
    );
  }

  return {
    valid: errors.length === 0,
    sanitized: sanitizedList,
    errors,
    warnings,
  };
}

/**
 * Naming Pattern Validator:
 * - Checks brace balancing {token}.
 * - Verifies that tokens match known supported token set.
 * - Checks for disallowed symbols (spaces, illegal delimiters).
 */
export const DEFAULT_NAMING_TOKENS = [
  '{org}', '{Org}', '{orgname}', '{ORGNAME}',
  '{sub}', '{SUB}', '{subname}', '{SUBNAME}',
  '{env}', '{ENV}', '{envname}', '{ENVNAME}',
  '{rg}', '{RG}', '{resourcegroup}', '{ResourceGroup}',
  '{region}', '{REGION}', '{regioncode}',
  '{type}', '{TYPE}', '{prefix}', '{PREFIX}',
  '{app}', '{APP}', '{workload}', '{WORKLOAD}',
  '{purpose}', '{PURPOSE}', '{role}',
  '{seq}', '{SEQ}', '{instance}', '{INSTANCE}'
];

export function validateNamingPattern(
  pattern: string,
  allowedTokens: string[] = DEFAULT_NAMING_TOKENS
): ValidationResult<string> {
  const p = (pattern || '').trim();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!p) {
    errors.push('Naming pattern cannot be empty.');
    return { valid: false, sanitized: '', errors, warnings };
  }

  // 1. Check brace matching
  const openBraces = (p.match(/\{/g) || []).length;
  const closeBraces = (p.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Unbalanced braces in pattern: ${openBraces} opening '{' vs ${closeBraces} closing '}'.`);
  }

  // 2. Extract tokens
  const tokenRegex = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  const recognizedTokensLower = new Set(allowedTokens.map((t) => t.toLowerCase()));
  const unrecognizedTokens: string[] = [];

  while ((match = tokenRegex.exec(p)) !== null) {
    const fullToken = match[0];
    if (!recognizedTokensLower.has(fullToken.toLowerCase())) {
      unrecognizedTokens.push(fullToken);
    }
  }

  if (unrecognizedTokens.length > 0) {
    warnings.push(
      `Unrecognized token(s): ${unrecognizedTokens.join(', ')}. Standard tokens include: {org}, {env}, {region}, {app}, {type}, {seq}.`
    );
  }

  // 3. Check illegal characters
  if (/[\s*!@#$%^&+=[\]\\|;:'",<>?`~]/.test(p)) {
    warnings.push('Pattern contains spaces or special symbols that may be rejected by Azure ARM resources.');
  }

  return {
    valid: errors.length === 0,
    sanitized: p,
    errors,
    warnings,
  };
}

/**
 * Alphanumeric Prefix Validator (for Org, Environment, Region, Purpose codes)
 */
export function validateAlphanumericPrefix(
  val: string,
  options: { min?: number; max?: number; uppercase?: boolean } = {}
): ValidationResult<string> {
  const { min = 1, max = 10, uppercase = true } = options;
  const trimmed = (val || '').trim();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!trimmed) {
    errors.push('Code cannot be empty.');
  } else {
    if (trimmed.length < min) {
      errors.push(`Code must be at least ${min} characters long.`);
    }
    if (trimmed.length > max) {
      errors.push(`Code cannot exceed ${max} characters (currently ${trimmed.length}).`);
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
      errors.push('Code must contain only alphanumeric characters (no spaces, dashes, or symbols).');
    }
  }

  let sanitized = trimmed.replace(/[^a-zA-Z0-9]/g, '');
  if (uppercase) sanitized = sanitized.toUpperCase();

  return {
    valid: errors.length === 0,
    sanitized,
    errors,
    warnings,
  };
}

/**
 * Azure GUID / UUID Validator (for Subscription ID, Tenant ID)
 */
export function validateAzureGuid(val: string): ValidationResult<string> {
  const trimmed = (val || '').trim();
  const errors: string[] = [];
  const warnings: string[] = [];

  const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  if (!trimmed) {
    errors.push('ID cannot be empty.');
  } else if (!guidRegex.test(trimmed)) {
    errors.push('Must be a valid Azure GUID format (e.g. 00000000-0000-0000-0000-000000000000).');
  }

  return {
    valid: errors.length === 0,
    sanitized: trimmed,
    errors,
    warnings,
  };
}

/**
 * Auto-Sanitizer Helper
 */
export function sanitizeInput(
  val: string,
  rule: 'alphanumeric' | 'tag-key' | 'tag-value' | 'pattern'
): string {
  if (!val) return '';
  switch (rule) {
    case 'alphanumeric':
      return val.replace(/[^a-zA-Z0-9]/g, '');
    case 'tag-key':
    case 'tag-value':
      return val.replace(AZURE_DISALLOWED_TAG_CHARS_GLOBAL_REGEX, '');
    case 'pattern':
      return val.replace(/[\s]/g, '-');
    default:
      return val;
  }
}
