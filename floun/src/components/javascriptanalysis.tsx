import { AnalysisFinding } from './analysisFinding';
import { getJavaScriptCryptoRules } from './cryptoRules';

interface ScriptScanResult {
  type?: string;
  src?: string;
  content?: string;
}

const compactSnippet = (content: string, index: number, matchLength: number): string => {
  const snippetStart = Math.max(index - 30, 0);
  const snippetEnd = Math.min(index + matchLength + 30, content.length);
  return content.substring(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim();
};

const stripJavaScriptCommentsPreservingOffsets = (content: string): string => {
  let output = "";
  let quote: "'" | '"' | "`" | null = null;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (quote) {
      output += char;

      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      output += "  ";
      index += 1;

      while (index + 1 < content.length && content[index + 1] !== "\n") {
        output += " ";
        index += 1;
      }

      continue;
    }

    if (char === "/" && next === "*") {
      output += "  ";
      index += 1;

      while (index + 1 < content.length) {
        const blockChar = content[index + 1];
        const blockNext = content[index + 2];
        output += blockChar === "\n" ? "\n" : " ";
        index += 1;

        if (blockChar === "*" && blockNext === "/") {
          output += " ";
          index += 1;
          break;
        }
      }

      continue;
    }

    output += char;
  }

  return output;
};

export const analyzeCryptoInJavascript = (scripts: unknown): AnalysisFinding[] => {
  const scriptList = Array.isArray(scripts) ? scripts as ScriptScanResult[] : [];
  const findings: AnalysisFinding[] = [];
  const rules = getJavaScriptCryptoRules();

  scriptList.forEach((script) => {
    const content = script.content || '';
    const searchableContent = stripJavaScriptCommentsPreservingOffsets(content);

    rules.forEach((rule) => {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(searchableContent)) !== null) {
        findings.push({
          ruleId: rule.id,
          source: 'JavaScript',
          severity: rule.severity,
          confidence: rule.confidence,
          title: `Found ${rule.name}`,
          location: `${script.type || 'unknown'} script (${script.src || 'inline'})`,
          evidence: compactSnippet(content, match.index, match[0].length),
          rationale: rule.rationale,
          limitations: rule.limitations,
          references: rule.references,
          standardStatus: rule.standardStatus,
          updatedAt: rule.updatedAt,
          recommendation: rule.recommendation,
        });
      }
    });
  });

  return findings.length > 0
    ? findings
    : [{
      source: 'JavaScript',
      severity: 'Info',
      title: 'No cryptographic methods found',
      location: 'JavaScript',
      details: 'No configured cryptographic patterns matched the scanned scripts.',
    }];
};
