/// <reference types="chrome"/>
import React, { useEffect, useState } from 'react';
import './App.css';
import { HeaderSecurityCheck } from './components/headerAnalysis';
import { analyzeCryptoInJavascript } from './components/javascriptanalysis';
import { analyzeCertificate } from './components/certificateanalysis';
import { analyzeTokens } from './components/tokenAnalysis';
import {
  AnalysisFinding,
  AnalysisSummary,
  emptyAnalysisSummary,
  summarizeFindings,
} from './components/analysisFinding';
import { ScanPayload, emptyScanMeta, scanActiveTab } from './extension/scanClient';

interface DashboardProps {
  resultsLoaded: boolean;
  jsResults: AnalysisFinding[];
  tokenResults: AnalysisFinding[];
  headerResults: AnalysisFinding[];
  certResults: AnalysisFinding[];
  jsSummary: AnalysisSummary;
  tokenSummary: AnalysisSummary;
  headerSummary: AnalysisSummary;
  certSummary: AnalysisSummary;
}

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'Unknown error'
);

const formatStatus = (status: string): string => (
  status
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
);

const FindingRows: React.FC<{ findings: AnalysisFinding[] }> = ({ findings }) => (
  <div className="finding-list">
    {findings.map((finding, index) => (
      <details className={`finding-row severity-${finding.severity.toLowerCase()}`} key={`${finding.source}-${finding.ruleId || finding.title}-${index}`}>
        <summary className="finding-summary">
          <span className="finding-severity">{finding.severity}</span>
          <span className="finding-title">{finding.title}</span>
          {finding.confidence && (
            <span className="finding-meta">{finding.confidence}</span>
          )}
          {finding.location && (
            <span className="finding-meta">{finding.location}</span>
          )}
        </summary>
        <div className="finding-detail">
          {finding.rationale && (
            <p><strong>Rationale:</strong> {finding.rationale}</p>
          )}
          {finding.details && (
            <p><strong>Details:</strong> {finding.details}</p>
          )}
          {finding.limitations && (
            <p><strong>Limitations:</strong> {finding.limitations}</p>
          )}
          {finding.recommendation && (
            <p><strong>Recommendation:</strong> {finding.recommendation}</p>
          )}
          {finding.evidence && (
            <p><strong>Evidence:</strong> {finding.evidence}</p>
          )}
          <div className="finding-attributes">
            {finding.ruleId && <span>Rule: {finding.ruleId}</span>}
            {finding.standardStatus && <span>Status: {formatStatus(finding.standardStatus)}</span>}
            {finding.updatedAt && <span>Updated: {finding.updatedAt}</span>}
          </div>
          {finding.references && finding.references.length > 0 && (
            <div className="finding-references">
              {finding.references.map((reference, referenceIndex) => (
                <a href={reference} target="_blank" rel="noreferrer" key={reference}>
                  Reference {referenceIndex + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      </details>
    ))}
  </div>
);

const displayAnalysisSection = (summary: AnalysisSummary, findings: AnalysisFinding[], title: string) => (
  <div className="analysis-section">
    <p className="section-title">{title} Results</p>
    <p>Total found: {summary.total}</p>
    <p>Safe: {summary.safe}</p>
    <p>Review: {summary.review}</p>
    <p>Vulnerable: {summary.vulnerable}</p>
    <p>Info: {summary.informational}</p>
    <FindingRows findings={findings} />
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({
  resultsLoaded,
  jsResults,
  tokenResults,
  headerResults,
  certResults,
  jsSummary,
  tokenSummary,
  headerSummary,
  certSummary,
}) => {
  const totalOccurrences = jsSummary.total + tokenSummary.total + headerSummary.total + certSummary.total;
  const [animateLoaded, setAnimateLoaded] = useState(false);

  useEffect(() => {
    if (!resultsLoaded) {
      setAnimateLoaded(false);
      return;
    }

    const timer = setTimeout(() => {
      setAnimateLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [resultsLoaded]);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Occurrences</h2>
        <div className={`total-occurrences ${animateLoaded ? 'loaded' : ''}`}>
          {totalOccurrences}
        </div>
      </div>
      <details className="results-dropdown">
        <summary>JavaScript Results</summary>
        <div className="results-content">
          {displayAnalysisSection(jsSummary, jsResults, 'JavaScript')}
        </div>
      </details>
      <details className="results-dropdown">
        <summary>Token Results</summary>
        <div className="results-content">
          {displayAnalysisSection(tokenSummary, tokenResults, 'Token')}
        </div>
      </details>
      <details className="results-dropdown">
        <summary>Header Results</summary>
        <div className="results-content">
          {displayAnalysisSection(headerSummary, headerResults, 'Header')}
        </div>
      </details>
      <details className="results-dropdown">
        <summary>Certificate Results</summary>
        <div className="results-content">
          {displayAnalysisSection(certSummary, certResults, 'Certificate')}
        </div>
      </details>
    </div>
  );
};

const App: React.FC = () => {
  const [scanError, setScanError] = useState<string | null>(null);
  const [jsResults, setJsResults] = useState<AnalysisFinding[]>([]);
  const [tokenResults, setTokenResults] = useState<AnalysisFinding[]>([]);
  const [headerResults, setHeaderResults] = useState<AnalysisFinding[]>([]);
  const [certResults, setCertResults] = useState<AnalysisFinding[]>([]);
  const [jsSummary, setJsSummary] = useState<AnalysisSummary>(emptyAnalysisSummary());
  const [tokenSummary, setTokenSummary] = useState<AnalysisSummary>(emptyAnalysisSummary());
  const [headerSummary, setHeaderSummary] = useState<AnalysisSummary>(emptyAnalysisSummary());
  const [certSummary, setCertSummary] = useState<AnalysisSummary>(emptyAnalysisSummary());
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resultsLoaded, setResultsLoaded] = useState(false);

  const setAnalysisResults = (scanPayload: ScanPayload) => {
    const nextJsResults = analyzeCryptoInJavascript(scanPayload.jsScripts);
    const nextHeaderResults = HeaderSecurityCheck(scanPayload.TLS);
    const nextCertResults = analyzeCertificate(scanPayload.certificates);
    const nextTokenResults = analyzeTokens(scanPayload.tokens);

    setJsResults(nextJsResults);
    setHeaderResults(nextHeaderResults);
    setCertResults(nextCertResults);
    setTokenResults(nextTokenResults);
    setJsSummary(summarizeFindings(nextJsResults));
    setHeaderSummary(summarizeFindings(nextHeaderResults));
    setCertSummary(summarizeFindings(nextCertResults));
    setTokenSummary(summarizeFindings(nextTokenResults));
    setScanWarnings(scanPayload.scanMeta?.warnings || emptyScanMeta().warnings);
  };

  const handleScan = async () => {
    setIsLoading(true);
    setResultsLoaded(false);
    setScanError(null);
    setScanWarnings([]);

    try {
      const scanPayload = await scanActiveTab();
      setAnalysisResults(scanPayload);
      setResultsLoaded(true);
    } catch (error) {
      setScanError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const { createReport } = await import('./components/ai-handler');
      await createReport(jsResults, tokenResults, headerResults, certResults);
    } catch (error) {
      setScanError(getErrorMessage(error));
    }
  };

  return (
    <div className="app">
      <div className="header">
        <img src="icons/floun.png" alt="Floun Logo" />
        <div id="rightHeader">
          <button id="scanBtn" onClick={handleScan} disabled={isLoading}>
            Scan
          </button>
        </div>
      </div>
      {isLoading && (
        <div className="loading">
          <img src="icons/icon_128.png" alt="Loading Animation" className="swimming-icon" />
        </div>
      )}
      {scanError && (
        <div id="results">
          <p>Error: {scanError}</p>
        </div>
      )}
      {resultsLoaded && !scanError && (
        <div id="results">
          {scanWarnings.length > 0 && (
            <div className="scan-warnings">
              <p>Partial scan warnings:</p>
              <ul>
                {scanWarnings.map((warning, index) => (
                  <li key={`scan-warning-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <Dashboard
            resultsLoaded={resultsLoaded}
            jsResults={jsResults}
            tokenResults={tokenResults}
            headerResults={headerResults}
            certResults={certResults}
            jsSummary={jsSummary}
            tokenSummary={tokenSummary}
            headerSummary={headerSummary}
            certSummary={certSummary}
          />
        </div>
      )}
      {resultsLoaded && (
        <button id="generateReportBtn" onClick={handleGenerateReport}>
          Generate Report
        </button>
      )}
    </div>
  );
};

export default App;
