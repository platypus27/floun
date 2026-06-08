/// <reference types="chrome"/>
import React, { useEffect, useState } from 'react';
import './App.css';
import { AnalysisFinding } from './components/analysisFinding';
import { AnalysisModuleResult, runAnalysisModules } from './components/analysisModules';
import { ScanPayload, emptyScanMeta, scanActiveTab } from './extension/scanClient';

interface DashboardProps {
  resultsLoaded: boolean;
  moduleResults: AnalysisModuleResult[];
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

const displayAnalysisSection = (moduleResult: AnalysisModuleResult) => (
  <div className="analysis-section">
    <p className="section-title">{moduleResult.label} Results</p>
    <p>Total found: {moduleResult.summary.total}</p>
    <p>Safe: {moduleResult.summary.safe}</p>
    <p>Review: {moduleResult.summary.review}</p>
    <p>Vulnerable: {moduleResult.summary.vulnerable}</p>
    <p>Info: {moduleResult.summary.informational}</p>
    <FindingRows findings={moduleResult.findings} />
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({
  resultsLoaded,
  moduleResults,
}) => {
  const totalOccurrences = moduleResults.reduce(
    (total, moduleResult) => total + moduleResult.summary.total,
    0
  );
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
      {moduleResults.map(moduleResult => (
        <details className="results-dropdown" key={moduleResult.id}>
          <summary>{moduleResult.label} Results</summary>
          <div className="results-content">
            {displayAnalysisSection(moduleResult)}
          </div>
        </details>
      ))}
    </div>
  );
};

const App: React.FC = () => {
  const [scanError, setScanError] = useState<string | null>(null);
  const [moduleResults, setModuleResults] = useState<AnalysisModuleResult[]>([]);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resultsLoaded, setResultsLoaded] = useState(false);

  const setAnalysisResults = (scanPayload: ScanPayload) => {
    setModuleResults(runAnalysisModules(scanPayload));
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
      await createReport(moduleResults);
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
            moduleResults={moduleResults}
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
