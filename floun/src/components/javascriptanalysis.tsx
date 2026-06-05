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

export const analyzeCryptoInJavascript = (scripts: unknown): AnalysisFinding[] => {
  const scriptList = Array.isArray(scripts) ? scripts as ScriptScanResult[] : [];
  const findings: AnalysisFinding[] = [];
  const rules = getJavaScriptCryptoRules();

  scriptList.forEach((script) => {
    const content = script.content || '';
    rules.forEach((rule) => {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(content)) !== null) {
        findings.push({
          ruleId: rule.id,
          source: 'JavaScript',
          severity: rule.severity,
          confidence: rule.confidence,
          title: `Found ${rule.name}`,
          location: `${script.type || 'unknown'} script (${script.src || 'inline'})`,
          evidence: compactSnippet(content, match.index, match[0].length),
          details: rule.rationale,
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
