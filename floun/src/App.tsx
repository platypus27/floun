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
import { ScanPayload, scanActiveTab } from './extension/scanClient';

interface DashboardProps {
  resultsLoaded: boolean;
  jsSummary: AnalysisSummary;
  tokenSummary: AnalysisSummary;
  headerSummary: AnalysisSummary;
  certSummary: AnalysisSummary;
}

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'Unknown error'
);

const displayAnalysisSummary = (summary: AnalysisSummary, title: string) => (
  <div className="analysis-section">
    <p className="section-title">{title} Results</p>
    <p>Total found: {summary.total}</p>
    <p>Safe: {summary.safe}</p>
    <p>Vulnerable: {summary.vulnerable}</p>
    <p>Info: {summary.informational}</p>
    {summary.vulnerable > 0 && (
      <div className="vulnerable-details">
        <p>Vulnerable Details:</p>
        <ul>
          {summary.vulnerableDetails.map((detail, index) => (
            <li key={`${title}-${index}`}>{detail}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({
  resultsLoaded,
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
          {displayAnalysisSummary(jsSummary, 'JavaScript')}
        </div>
      </details>
      <details className="results-dropdown">
        <summary>Token Results</summary>
        <div className="results-content">
          {displayAnalysisSummary(tokenSummary, 'Token')}
        </div>
      </details>
      <details className="results-dropdown">
        <summary>Header Results</summary>
        <div className="results-content">
          {displayAnalysisSummary(headerSummary, 'Header')}
        </div>
      </details>
      <details className="results-dropdown">
        <summary>Certificate Results</summary>
        <div className="results-content">
          {displayAnalysisSummary(certSummary, 'Certificate')}
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
  };

  const handleScan = async () => {
    setIsLoading(true);
    setResultsLoaded(false);
    setScanError(null);

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
          <Dashboard
            resultsLoaded={resultsLoaded}
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
