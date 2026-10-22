import React, { ReactNode } from 'react';

export type SyntaxLanguage = 'bicep' | 'bicepparam' | 'json' | 'arm' | 'powershell' | 'ps1' | 'bash' | 'sh' | 'terraform' | 'tf';

interface TokenRule {
  type: string;
  regex: RegExp;
}

const BICEP_KEYWORDS = new Set([
  'targetScope', 'resource', 'module', 'param', 'var', 'output', 'existing',
  'import', 'as', 'from', 'with', 'if', 'for', 'in', 'true', 'false', 'null'
]);

const BICEP_TYPES = new Set([
  'string', 'int', 'bool', 'object', 'array', 'secureObject', 'secureString'
]);

const POWERSHELL_KEYWORDS = new Set([
  'param', 'function', 'if', 'else', 'elseif', 'foreach', 'while', 'return',
  'try', 'catch', 'throw', 'true', 'false', 'null', 'Mandatory', 'switch'
]);

const BASH_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'while',
  'case', 'esac', 'function', 'return', 'exit', 'export', 'echo', 'set'
]);

/**
 * Tokenizes a single line of code into syntax highlighted React elements
 */
export function highlightLine(line: string, lang: string): ReactNode[] {
  const normLang = (lang || 'bicep').toLowerCase();

  // Handle empty lines cleanly
  if (!line) {
    return [' '];
  }

  // 1. Comments
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || (trimmed.startsWith('#') && normLang !== 'json')) {
    const indent = line.slice(0, line.length - trimmed.length);
    return [
      indent,
      <span key="comment" className="au-token-comment">{trimmed}</span>
    ];
  }

  // 2. Language Specific Tokenization
  if (normLang === 'json' || normLang === 'arm') {
    return tokenizeJsonLine(line);
  } else if (normLang === 'powershell' || normLang === 'ps1') {
    return tokenizePowershellLine(line);
  } else if (normLang === 'bash' || normLang === 'sh') {
    return tokenizeBashLine(line);
  } else {
    // Default: Bicep / Bicepparam / Terraform
    return tokenizeBicepLine(line);
  }
}

function tokenizeBicepLine(line: string): ReactNode[] {
  // Regex to match comments, strings, decorators, words, numbers, punctuation
  const tokenRegex = /(\/\/[^\n]*|\/\*.*?\*\/|'(?:[^'\\]|\\.)*'|@[a-zA-Z0-9_]+|\b[a-zA-Z_][a-zA-Z0-9_]*\b|\b\d+\b|[=!<>+\-*/&|]+|[{}()[\],.:;]|\s+)/g;
  const elements: ReactNode[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    const text = match[0];
    const key = `t-${idx++}`;

    if (text.startsWith('//') || text.startsWith('/*')) {
      elements.push(<span key={key} className="au-token-comment">{text}</span>);
    } else if (text.startsWith("'")) {
      elements.push(<span key={key} className="au-token-string">{text}</span>);
    } else if (text.startsWith('@')) {
      elements.push(<span key={key} className="au-token-decorator">{text}</span>);
    } else if (BICEP_KEYWORDS.has(text)) {
      elements.push(<span key={key} className="au-token-keyword">{text}</span>);
    } else if (BICEP_TYPES.has(text)) {
      elements.push(<span key={key} className="au-token-type">{text}</span>);
    } else if (/^\d+$/.test(text)) {
      elements.push(<span key={key} className="au-token-number">{text}</span>);
    } else {
      elements.push(text);
    }
  }

  return elements.length > 0 ? elements : [line];
}

function tokenizeJsonLine(line: string): ReactNode[] {
  const tokenRegex = /("(?:[^"\\]|\\.)*")\s*(:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?\b|[{}[\],:]|\s+|[^\s"{}[\]:,]+/g;
  const elements: ReactNode[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    const text = match[0];
    const key = `json-${idx++}`;

    if (match[1]) {
      // String or Key
      if (match[2]) {
        // It is followed by colon -> JSON Key
        elements.push(<span key={key} className="au-token-keyword">{match[1]}</span>);
        elements.push(':');
      } else {
        // Regular JSON string value
        elements.push(<span key={key} className="au-token-string">{match[1]}</span>);
      }
    } else if (match[3]) {
      elements.push(<span key={key} className="au-token-function">{match[3]}</span>);
    } else if (/^-?\d+(\.\d+)?$/.test(text)) {
      elements.push(<span key={key} className="au-token-number">{text}</span>);
    } else {
      elements.push(text);
    }
  }

  return elements.length > 0 ? elements : [line];
}

function tokenizePowershellLine(line: string): ReactNode[] {
  const tokenRegex = /(#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\$[a-zA-Z0-9_:]+|-[a-zA-Z0-9_]+|\b[a-zA-Z_][a-zA-Z0-9_-]*\b|\b\d+\b|\s+|.)/g;
  const elements: ReactNode[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    const text = match[0];
    const key = `ps-${idx++}`;

    if (text.startsWith('#')) {
      elements.push(<span key={key} className="au-token-comment">{text}</span>);
    } else if (text.startsWith('"') || text.startsWith("'")) {
      elements.push(<span key={key} className="au-token-string">{text}</span>);
    } else if (text.startsWith('$')) {
      elements.push(<span key={key} className="au-token-decorator">{text}</span>);
    } else if (text.startsWith('-') && text.length > 1) {
      elements.push(<span key={key} className="au-token-function">{text}</span>);
    } else if (POWERSHELL_KEYWORDS.has(text)) {
      elements.push(<span key={key} className="au-token-keyword">{text}</span>);
    } else if (/^\d+$/.test(text)) {
      elements.push(<span key={key} className="au-token-number">{text}</span>);
    } else {
      elements.push(text);
    }
  }

  return elements.length > 0 ? elements : [line];
}

function tokenizeBashLine(line: string): ReactNode[] {
  const tokenRegex = /(#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\$[a-zA-Z0-9_{}]+|--?[a-zA-Z0-9_-]+|\b[a-zA-Z_][a-zA-Z0-9_]*\b|\b\d+\b|\s+|.)/g;
  const elements: ReactNode[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    const text = match[0];
    const key = `sh-${idx++}`;

    if (text.startsWith('#')) {
      elements.push(<span key={key} className="au-token-comment">{text}</span>);
    } else if (text.startsWith('"') || text.startsWith("'")) {
      elements.push(<span key={key} className="au-token-string">{text}</span>);
    } else if (text.startsWith('$')) {
      elements.push(<span key={key} className="au-token-decorator">{text}</span>);
    } else if (text.startsWith('-') && text.length > 1) {
      elements.push(<span key={key} className="au-token-function">{text}</span>);
    } else if (BASH_KEYWORDS.has(text)) {
      elements.push(<span key={key} className="au-token-keyword">{text}</span>);
    } else if (/^\d+$/.test(text)) {
      elements.push(<span key={key} className="au-token-number">{text}</span>);
    } else {
      elements.push(text);
    }
  }

  return elements.length > 0 ? elements : [line];
}
