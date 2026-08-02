import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, ChevronRight, BarChart2, Plus, 
  Trash2, GitMerge, Scissors, Check, X, Edit3, 
  Sparkles, Download, Copy, AlertCircle, AlertTriangle 
} from 'lucide-react';
import './App.css';

// Date formatter utility
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

// MOCK DATA to make the UI immediately functional and testable before the backend is run
const MOCK_THEMES = [
  {
    id: "theme-1",
    title: "Safari PDF Export Crashes",
    problem_statement: "Users running Mac Safari experience tab freezes and white screen crashes when attempting to export multi-page transaction reports.",
    primary_product_area: "Reporting",
    status: "PENDING",
    supporting_row_ids: [0, 4, 18, 29],
    is_pattern: true,
    matched_historical_themes: [
      {
        id: "hist-2",
        title: "Safari PDF Export Crashes",
        problem_statement: "Users running Mac Safari experience tab freezes and white screen crashes when attempting to export multi-page transaction reports."
      }
    ],
    matched_product_notes: [
      {
        id: "note-2",
        title: "v2.3.1 (Safari WebKit PDF Fix)",
        description: "Fixed tab freezing issues on Safari browsers during PDF export operations.",
        date: "2026-06-10T00:00:00.000Z",
        type: "BUGFIX"
      }
    ],
    source_distribution: { Support: 2, "App Store": 1, Email: 1 },
    user_type_distribution: { Free: 1, Premium: 2, Enterprise: 1 },
    frequency: { "May 2026": 1, "June 2026": 2, "July 2026": 1 }
  },
  {
    id: "theme-2",
    title: "Slow Invoice Search Latency",
    problem_statement: "Search query performance degrades significantly when filtering historical billing records.",
    primary_product_area: "Billing",
    status: "PENDING",
    supporting_row_ids: [1, 7, 12],
    is_pattern: true,
    matched_historical_themes: [
      {
        id: "hist-3",
        title: "Slow Invoice Search Latency",
        problem_statement: "Search query performance degrades significantly when filtering historical billing records."
      }
    ],
    matched_product_notes: [
      {
        id: "note-3",
        title: "v2.4.0 (Database Index Optimization)",
        description: "Optimized index tables for billing and invoice transaction searches to lower latency below 100ms.",
        date: "2026-07-01T00:00:00.000Z",
        type: "RELEASE_NOTE"
      }
    ],
    source_distribution: { Support: 1, "App Store": 0, Email: 2 },
    user_type_distribution: { Free: 2, Premium: 0, Enterprise: 1 },
    frequency: { "May 2026": 0, "June 2026": 1, "July 2026": 2 }
  },
  {
    id: "theme-3",
    title: "Isolated comment: UI alignment",
    problem_statement: "Card authorization timeout spinner overlaps with the checkout submit button on mobile views.",
    primary_product_area: "Payments",
    status: "PENDING",
    supporting_row_ids: [29],
    is_pattern: false,
    matched_historical_themes: [],
    matched_product_notes: [],
    source_distribution: { Support: 1, "App Store": 0, Email: 0 },
    user_type_distribution: { Free: 0, Premium: 1, Enterprise: 0 },
    frequency: { "May 2026": 0, "June 2026": 0, "July 2026": 1 }
  }
];

const MOCK_CITATIONS = {
  0: { text: "App crashes every time I export a multi-page PDF on Safari Mac.", source: "Support", user_type: "Premium" },
  4: { text: "Export button freezes Safari completely. Had to force quit the tab.", source: "Support", user_type: "Enterprise" },
  18: { text: "Stuck on white screen during billing export page on Mac.", source: "App Store", user_type: "Free" },
  29: { text: "Spinning loader covers the final pay button on my iPhone screen.", source: "Support", user_type: "Premium" },
  1: { text: "Filters take over 10 seconds to respond when looking up invoices from last year.", source: "Email", user_type: "Free" },
  7: { text: "Billing search is incredibly sluggish. Hard to reconcile accounts.", source: "Email", user_type: "Enterprise" },
  12: { text: "Loading historical invoices times out.", source: "Support", user_type: "Free" }
};

export default function App() {
  const [themes, setThemes] = useState(MOCK_THEMES);
  const [citations, setCitations] = useState(MOCK_CITATIONS);
  const [selectedTheme, setSelectedTheme] = useState(null); // Active theme for Drawer
  const [showDrawerMatches, setShowDrawerMatches] = useState(false); // Collapsible matches in Drawer
  const [expandedDrawerHistIds, setExpandedDrawerHistIds] = useState([]); // List of expanded hist theme IDs in Drawer
  const [expandedDrawerNoteIds, setExpandedDrawerNoteIds] = useState([]); // List of expanded note IDs in Drawer
  const [uploadedFileName, setUploadedFileName] = useState("Mock Dataset"); // Name of uploaded CSV file
  const [selectedRows, setSelectedRows] = useState([]); // Checked rows for Split
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [errorAlert, setErrorAlert] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [activeTab, setActiveTab] = useState('PENDING'); // PENDING, APPROVED, REJECTED
  
  // Modals state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameThemeId, setRenameThemeId] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameProblem, setRenameProblem] = useState("");
  
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitTitle, setSplitTitle] = useState("");
  const [splitProblem, setSplitProblem] = useState("");
  
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");

  // Handle toast timers
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // API Call Fallbacks: Load from backend if active, else stay on mocks
  const fetchThemes = async () => {
    try {
      const res = await fetch('/api/themes');
      if (res.ok) {
        const data = await res.json();
        setThemes(data.themes || []);
        setCitations(data.citations || {});
        if (data.filename) {
          setUploadedFileName(data.filename);
        }
      }
    } catch (e) {
      console.log("Backend not running yet. Operating in local Mock Mode.");
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  // Ingest CSV Handler
  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setErrorAlert("Invalid file format. Please upload a valid CSV file.");
      return;
    }

    setLoading(true);
    setLoadingMessage("Parsing feedback CSV...");
    setErrorAlert(null);

    // Form data upload simulation / real backend call
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        let errMsg = "Failed to parse CSV file.";
        try {
          const errorData = await res.json();
          errMsg = errorData.message || errMsg;
        } catch (_) {
          try {
            errMsg = await res.text();
          } catch (_) {}
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      setThemes(data.themes);
      setCitations(data.citations);
      if (data.filename) {
        setUploadedFileName(data.filename);
      }
      setSuccessToast("CSV uploaded and semantically clustered successfully!");
    } catch (e) {
      console.error("Upload failed:", e);
      setErrorAlert(e.message || "Failed to communicate with the backend server. Please verify your backend server on port 5000 is active.");
    } finally {
      setLoading(false);
    }
  };

  // Status changes: Approve / Reject
  const updateThemeStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/themes/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchThemes();
      } else {
        throw new Error("API failed");
      }
    } catch (e) {
      // Mock update
      setThemes(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      setSuccessToast(`Theme status updated to ${status}.`);
    }
  };

  // Merge Themes Action
  const handleMergeThemes = async () => {
    if (!mergeTargetId) return;

    try {
      const res = await fetch('/api/themes/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: mergeSourceId, targetId: mergeTargetId })
      });
      if (res.ok) {
        fetchThemes();
      } else {
        throw new Error("API failed");
      }
    } catch (e) {
      // Mock merge logic
      const source = themes.find(t => t.id === mergeSourceId);
      const target = themes.find(t => t.id === mergeTargetId);
      
      if (source && target) {
        const combinedRowIds = [...new Set([...source.supporting_row_ids, ...target.supporting_row_ids])];
        
        // Recalculate combined statistics deterministically
        const combinedSources = { ...target.source_distribution };
        Object.entries(source.source_distribution).forEach(([k, v]) => {
          combinedSources[k] = (combinedSources[k] || 0) + v;
        });

        const combinedUsers = { ...target.user_type_distribution };
        Object.entries(source.user_type_distribution).forEach(([k, v]) => {
          combinedUsers[k] = (combinedUsers[k] || 0) + v;
        });

        const combinedFreq = { ...target.frequency };
        Object.entries(source.frequency).forEach(([k, v]) => {
          combinedFreq[k] = (combinedFreq[k] || 0) + v;
        });

        const updatedThemes = themes
          .map(t => {
            if (t.id === mergeTargetId) {
              return {
                ...t,
                supporting_row_ids: combinedRowIds,
                source_distribution: combinedSources,
                user_type_distribution: combinedUsers,
                frequency: combinedFreq,
                is_pattern: true
              };
            }
            return t;
          })
          .filter(t => t.id !== mergeSourceId); // Remove merged theme
        
        setThemes(updatedThemes);
        setSuccessToast("Themes merged successfully!");
      }
    } finally {
      setIsMergeModalOpen(false);
      setMergeSourceId(null);
      setMergeTargetId("");
    }
  };

  // Trigger Split Modal Setup
  const triggerSplitModal = () => {
    if (selectedRows.length === 0 || !selectedTheme) return;
    
    // Check if user is trying to split ALL rows
    if (selectedRows.length === selectedTheme.supporting_row_ids.length) {
      setErrorAlert("Cannot split all rows. Please leave at least one row in the original theme.");
      return;
    }

    setSplitTitle(`Split from ${selectedTheme.title}`);
    setSplitProblem(`Customer issues split off from theme: ${selectedTheme.title}.`);
    setIsSplitModalOpen(true);
  };

  // Split Theme Action (triggered upon modal submission)
  const handleSplitTheme = async () => {
    if (selectedRows.length === 0 || !selectedTheme || !splitTitle.trim()) return;

    try {
      const res = await fetch(`/api/themes/${selectedTheme.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          splitRowIds: selectedRows, 
          title: splitTitle, 
          problem_statement: splitProblem 
        })
      });
      if (res.ok) {
        fetchThemes();
      } else {
        throw new Error("API failed");
      }
    } catch (e) {
      // Mock Split
      const remainingRowIds = selectedTheme.supporting_row_ids.filter(id => !selectedRows.includes(id));
      
      // Create a new split theme
      const newThemeId = `theme-split-${Date.now()}`;
      const newTheme = {
        id: newThemeId,
        title: splitTitle,
        problem_statement: splitProblem,
        primary_product_area: selectedTheme.primary_product_area,
        status: "PENDING",
        supporting_row_ids: selectedRows,
        is_pattern: selectedRows.length > 1,
        matched_historical_themes: [],
        matched_product_notes: [],
        source_distribution: { Support: 1, "App Store": 0, Email: 0 }, 
        user_type_distribution: { Free: 0, Premium: 1, Enterprise: 0 },
        frequency: { "July 2026": selectedRows.length }
      };

      // Recalculate original theme stats
      const updatedOriginal = {
        ...selectedTheme,
        supporting_row_ids: remainingRowIds,
        is_pattern: remainingRowIds.length > 1
      };

      setThemes(prev => prev.map(t => t.id === selectedTheme.id ? updatedOriginal : t).concat(newTheme));
      setSelectedTheme(updatedOriginal);
    } finally {
      setSelectedRows([]);
      setIsSplitModalOpen(false);
      setSplitTitle("");
      setSplitProblem("");
      setSuccessToast("Theme successfully split!");
    }
  };

  // Rename / Edit Theme Action
  const handleRenameTheme = async () => {
    if (!renameTitle.trim()) return;

    try {
      const res = await fetch(`/api/themes/${renameThemeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameTitle, problem_statement: renameProblem })
      });
      if (res.ok) {
        fetchThemes();
      } else {
        throw new Error("API failed");
      }
    } catch (e) {
      // Mock rename
      setThemes(prev => prev.map(t => t.id === renameThemeId ? { ...t, title: renameTitle, problem_statement: renameProblem } : t));
      setSuccessToast("Theme details saved.");
    } finally {
      setIsRenameModalOpen(false);
      setRenameThemeId(null);
    }
  };

  // Compile Plaintext ASCII Synthesis Report
  const generateReport = async () => {
    setLoading(true);
    setLoadingMessage("Compiling synthesis report...");
    
    try {
      const res = await fetch('/api/report');
      if (res.ok) {
        const text = await res.text();
        setReportText(text);
        setIsReportOpen(true);
      } else {
        throw new Error("API failed");
      }
    } catch (e) {
      // Mock report compiler
      const approvedThemes = themes.filter(t => t.status === 'APPROVED');
      if (approvedThemes.length === 0) {
        setErrorAlert("No themes have been APPROVED yet. Approve at least one theme to generate a report.");
        setLoading(false);
        return;
      }

      let report = "";
      approvedThemes.forEach((theme, index) => {
        report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        report += `THEME ${index + 1}: ${theme.title.toUpperCase()}\n`;
        report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        report += `Problem Statement:\n${theme.problem_statement}\n\n`;
        report += `Pattern:\n${theme.is_pattern ? "Recurring Pattern" : "Isolated Comment"}\n\n`;
        report += `Historical Context:\n`;
        report += `⚠️ Matches Historical Themes: ${(theme.matched_historical_themes && theme.matched_historical_themes.length > 0) ? theme.matched_historical_themes.map(h => h.title).join(", ") : "None"}\n`;
        report += `🚀 Related Release Notes: ${(theme.matched_product_notes && theme.matched_product_notes.length > 0) ? theme.matched_product_notes.map(n => n.title).join(", ") : "None"}\n\n`;
        report += `Feedback Count:\n${theme.supporting_row_ids.length}\n\n`;
        report += `Product Area:\n${theme.primary_product_area}\n\n`;
        
        report += `SOURCE DISTRIBUTION\n`;
        Object.entries(theme.source_distribution).forEach(([source, count]) => {
          report += `${source.padEnd(14)}${count}\n`;
        });
        report += `\nUSER TYPE DISTRIBUTION\n`;
        Object.entries(theme.user_type_distribution).forEach(([type, count]) => {
          report += `${type.padEnd(14)}${count}\n`;
        });
        
        report += `\nFEEDBACK FREQUENCY\n`;
        Object.entries(theme.frequency).forEach(([month, count]) => {
          const bar = "█".repeat(Math.max(1, count * 3));
          report += `${month.padEnd(14)}${bar.padEnd(12)}${count}\n`;
        });
        
        report += `\nSUPPORTING CITATIONS & RAW EVIDENCE\n`;
        theme.supporting_row_ids.forEach(rowId => {
          const cit = citations[rowId] || { text: "Raw feedback citation text...", source: "Unknown", user_type: "Unknown" };
          report += `• Row #${rowId} [${cit.source} / ${cit.user_type}]: "${cit.text}"\n`;
        });
        report += `\n\n`;
      });
      
      setReportText(report);
      setIsReportOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleClearDashboard = async () => {
    if (!window.confirm("Are you sure you want to clear the entire dashboard? This will delete all active themes and raw feedback from the database.")) {
      return;
    }
    setLoading(true);
    setLoadingMessage("Clearing dashboard...");
    try {
      const res = await fetch('/api/themes', {
        method: 'DELETE'
      });
      if (res.ok) {
        setThemes([]);
        setCitations({});
        setUploadedFileName("Mock Dataset");
        setSuccessToast("Dashboard and database cleared successfully!");
      } else {
        throw new Error("Failed to clear database.");
      }
    } catch (e) {
      setThemes([]);
      setCitations({});
      setUploadedFileName("Mock Dataset");
      setSuccessToast("Dashboard cleared (mock mode).");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPipeline = async () => {
    try {
      const res = await fetch('/api/upload/abort', { method: 'POST' });
      if (res.ok) {
        setLoading(false);
        setSuccessToast("AI Pipeline parsing aborted successfully.");
      }
    } catch (e) {
      setLoading(false);
      setSuccessToast("Pipeline aborted.");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(reportText);
    setSuccessToast("Report copied to clipboard!");
  };

  // UI state filters
  const pendingThemes = themes.filter(t => t.status === 'PENDING');
  const approvedThemes = themes.filter(t => t.status === 'APPROVED');
  const rejectedThemes = themes.filter(t => t.status === 'REJECTED');

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f3f4f6] font-sans antialiased">
      
      {/* HEADER */}
      <header className="glass-panel sticky top-0 z-30 border-b border-gray-800 py-4 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30">
            <Sparkles className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AI Feedback Synthesis Assistant</h1>
            <p className="text-xs text-gray-400">Human-in-the-Loop Product Analysis Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Upload Button */}
          <label className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700/80 border border-gray-700 text-sm font-medium px-4 py-2 rounded-xl cursor-pointer transition">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Upload CSV</span>
            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          </label>

          {/* Save Report Button */}
          <button 
            onClick={generateReport}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition"
          >
            <FileText className="w-4 h-4" />
            <span>Save Report</span>
          </button>

          {/* Clear Dashboard Button */}
          {themes.length > 0 && (
            <button 
              onClick={handleClearDashboard}
              className="flex items-center gap-2 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2 rounded-xl transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Dashboard</span>
            </button>
          )}
        </div>
      </header>

      {/* WORKSPACE & BOARDS */}
      <main className="max-w-7xl mx-auto px-6 py-8 md:px-12">
        
        {/* Error Alert Bar */}
        {errorAlert && (
          <div className="mb-6 flex items-center justify-between p-4 bg-red-900/35 border border-red-500/40 rounded-2xl text-red-200 text-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorAlert}</span>
            </div>
            <button onClick={() => setErrorAlert(null)} className="text-red-400 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dynamic Board Columns */}
        {themes.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-3xl p-12 max-w-xl mx-auto border border-gray-800/80 mt-12">
            <div className="bg-indigo-600/10 p-6 rounded-3xl border border-indigo-500/20 mb-6">
              <Upload className="w-12 h-12 text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No feedback loaded yet</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-sm">
              Upload a customer feedback CSV containing fields for text, source, user type, and product area to begin AI clustering.
            </p>
            <label className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-6 py-3 rounded-xl cursor-pointer transition">
              Select CSV File
              <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Tab Selector Status Filters */}
            <div className="flex border-b border-gray-800 shrink-0 overflow-x-auto gap-2">
              <button 
                onClick={() => setActiveTab('PENDING')}
                className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold tracking-tight transition shrink-0 ${
                  activeTab === 'PENDING' 
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-950/10' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>Pending Review</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === 'PENDING' ? 'bg-indigo-950 text-indigo-400 border border-indigo-900/35' : 'bg-gray-800 text-gray-400'
                }`}>{pendingThemes.length}</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('APPROVED')}
                className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold tracking-tight transition shrink-0 ${
                  activeTab === 'APPROVED' 
                    ? 'border-green-500 text-green-400 bg-green-950/10' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>Approved Themes</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === 'APPROVED' ? 'bg-green-950 text-green-400 border border-green-900/35' : 'bg-gray-800 text-gray-400'
                }`}>{approvedThemes.length}</span>
              </button>

              <button 
                onClick={() => setActiveTab('REJECTED')}
                className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold tracking-tight transition shrink-0 ${
                  activeTab === 'REJECTED' 
                    ? 'border-red-500 text-red-400 bg-red-950/10' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>Rejected / Discarded</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === 'REJECTED' ? 'bg-red-950 text-red-400 border border-red-900/35' : 'bg-gray-800 text-gray-400'
                }`}>{rejectedThemes.length}</span>
              </button>
            </div>

            {/* Active Workspace Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[500px]">
              
              {activeTab === 'PENDING' && (
                pendingThemes.length === 0 ? (
                  <div className="col-span-full text-center py-20 text-gray-500 text-sm border border-dashed border-gray-800 rounded-3xl bg-gray-900/5">
                    No pending items. All customer feedback has been successfully processed!
                  </div>
                ) : (
                  pendingThemes.map(theme => (
                    <ThemeCard 
                      key={theme.id} 
                      theme={theme}
                      onRename={() => {
                        setRenameThemeId(theme.id);
                        setRenameTitle(theme.title);
                        setRenameProblem(theme.problem_statement);
                        setIsRenameModalOpen(true);
                      }}
                      onMerge={() => {
                        setMergeSourceId(theme.id);
                        setIsMergeModalOpen(true);
                      }}
                      onOpenDrawer={() => setSelectedTheme(theme)}
                      onApprove={() => updateThemeStatus(theme.id, 'APPROVED')}
                      onReject={() => updateThemeStatus(theme.id, 'REJECTED')}
                      uploadedFileName={uploadedFileName}
                    />
                  ))
                )
              )}

              {activeTab === 'APPROVED' && (
                approvedThemes.length === 0 ? (
                  <div className="col-span-full text-center py-20 text-gray-550 text-sm border border-dashed border-gray-800 rounded-3xl bg-gray-900/5">
                    No approved themes yet. Approve cards from Pending Review to list them here.
                  </div>
                ) : (
                  approvedThemes.map(theme => (
                    <ThemeCard 
                      key={theme.id} 
                      theme={theme}
                      onRename={() => {
                        setRenameThemeId(theme.id);
                        setRenameTitle(theme.title);
                        setRenameProblem(theme.problem_statement);
                        setIsRenameModalOpen(true);
                      }}
                      onMerge={() => {
                        setMergeSourceId(theme.id);
                        setIsMergeModalOpen(true);
                      }}
                      onOpenDrawer={() => setSelectedTheme(theme)}
                      onApprove={null}
                      onReject={() => updateThemeStatus(theme.id, 'REJECTED')}
                      uploadedFileName={uploadedFileName}
                    />
                  ))
                )
              )}

              {activeTab === 'REJECTED' && (
                rejectedThemes.length === 0 ? (
                  <div className="col-span-full text-center py-20 text-gray-550 text-sm border border-dashed border-gray-800 rounded-3xl bg-gray-900/5">
                    No rejected items.
                  </div>
                ) : (
                  rejectedThemes.map(theme => (
                    <ThemeCard 
                      key={theme.id} 
                      theme={theme}
                      onRename={null}
                      onMerge={null}
                      onOpenDrawer={() => setSelectedTheme(theme)}
                      onApprove={() => updateThemeStatus(theme.id, 'APPROVED')}
                      onReject={null}
                      isRejected={true}
                      uploadedFileName={uploadedFileName}
                    />
                  ))
                )
              )}

            </div>
          </div>
        )}

      </main>

      {/* DRAWER: CITATIONS VIEW & SPLIT CONTROL */}
      {selectedTheme && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div onClick={() => { setSelectedTheme(null); setSelectedRows([]); setShowDrawerMatches(false); setExpandedDrawerHistIds([]); setExpandedDrawerNoteIds([]); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md md:max-w-lg bg-[#0e1322] border-l border-gray-800 h-full flex flex-col shadow-2xl">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/30">
                <div>
                  <h2 className="text-lg font-semibold text-gray-150">{selectedTheme.title}</h2>
                  <p className="text-xs text-gray-400 mt-1">Citations & Raw Evidence ({selectedTheme.supporting_row_ids.length})</p>
                </div>
                <button onClick={() => { setSelectedTheme(null); setSelectedRows([]); setShowDrawerMatches(false); setExpandedDrawerHistIds([]); setExpandedDrawerNoteIds([]); }} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Problem Statement</span>
                  <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/80 text-sm text-gray-300 leading-relaxed">
                    {selectedTheme.problem_statement}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Supporting Feedback Citations ({uploadedFileName})</span>
                    <span className="text-[11px] text-gray-500">Select any unrelated feedback rows below to split them into a new theme card.</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-900/30 border border-gray-850 rounded-xl">
                    <span className="text-xs text-gray-400 font-medium">
                      {selectedRows.length === 0 
                        ? "Select items below to enable split..." 
                        : `${selectedRows.length} item(s) selected for split`
                      }
                    </span>
                    <button 
                      onClick={triggerSplitModal}
                      disabled={selectedRows.length === 0}
                      className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-semibold border transition-all duration-200 ${
                        selectedRows.length > 0
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                          : 'bg-gray-900/40 text-gray-550 border-gray-800 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Split Selected ({selectedRows.length})</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {selectedTheme.supporting_row_ids.map(rowId => {
                      const cit = citations[rowId] || { text: "Raw feedback text...", source: "Unknown", user_type: "Unknown" };
                      const isChecked = selectedRows.includes(rowId);
                      
                      return (
                        <div 
                          key={rowId} 
                          onClick={() => {
                            setSelectedRows(prev => 
                              prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
                            );
                          }}
                          className={`p-4 rounded-xl border text-sm transition cursor-pointer select-none ${
                            isChecked 
                              ? 'bg-indigo-950/20 border-indigo-500/55' 
                              : 'bg-gray-950/40 border-gray-800/85 hover:border-gray-700/80'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              readOnly
                              className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="space-y-2 flex-1">
                              <p className="text-gray-300 leading-relaxed text-sm md:text-base">{cit.text}</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">Row: #{rowId}</span>
                                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-medium">Source: {cit.source}</span>
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  cit.user_type === 'Free'
                                    ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-900/35'
                                    : cit.user_type === 'Premium'
                                    ? 'bg-purple-950/60 text-purple-400 border border-purple-900/35'
                                    : 'bg-amber-950/60 text-amber-400 border border-amber-900/35'
                                }`}>
                                  User Type: {cit.user_type}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* RENAME/EDIT MODAL */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsRenameModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#0e1322] border border-gray-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold">Rename & Edit Theme</h3>
              <p className="text-xs text-gray-400">Modify the synthesized name and problem statement.</p>
            </div>
            
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-medium">Theme Title</label>
                <input 
                  type="text" 
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 transition"
                  placeholder="e.g. Mobile Layout Overlaps"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-medium">Synthesized Problem Statement</label>
                <textarea 
                  value={renameProblem}
                  onChange={(e) => setRenameProblem(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 transition resize-none"
                  placeholder="Summarize the core user pain point..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => setIsRenameModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleRenameTheme}
                className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPLIT MODAL */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsSplitModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#0e1322] border border-gray-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6 animate-scaleIn">
            <div>
              <h3 className="text-base font-semibold text-gray-150">Split Off Feedback</h3>
              <p className="text-xs text-gray-400 mt-1">Specify details for the new theme containing the {selectedRows.length} selected customer feedback comment(s).</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-medium">New Theme Title</label>
                <input 
                  type="text"
                  value={splitTitle}
                  onChange={(e) => setSplitTitle(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 transition"
                  placeholder="e.g. Broken Payment API Gateway"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-medium">Synthesized Problem Statement</label>
                <textarea 
                  value={splitProblem}
                  onChange={(e) => setSplitProblem(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 transition resize-none"
                  placeholder="Summarize the core user pain point for the split items..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => setIsSplitModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSplitTheme}
                disabled={!splitTitle.trim()}
                className={`px-4 py-2 text-xs font-semibold rounded-lg border transition ${
                  splitTitle.trim()
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-gray-900/40 text-gray-550 border-gray-800 cursor-not-allowed'
                }`}
              >
                Create Split Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MERGE MODAL */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsMergeModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#0e1322] border border-gray-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold">Merge with Another Theme</h3>
              <p className="text-xs text-gray-400">Combine all supporting feedback rows into a single theme.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-medium">Select Target Theme</label>
              <select 
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="">-- Choose target theme --</option>
                {themes
                  .filter(t => t.id !== mergeSourceId && t.status !== 'REJECTED')
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.supporting_row_ids.length} rows)</option>
                  ))
                }
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => setIsMergeModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleMergeThemes}
                disabled={!mergeTargetId}
                className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT PREVIEW MODAL */}
      {isReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsReportOpen(false)} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div className="relative bg-[#0e1322] border border-gray-800 w-full max-w-3xl h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/20 shrink-0">
              <div>
                <h3 className="text-base font-semibold">Plaintext Synthesis Report</h3>
                <p className="text-xs text-gray-400">ASCII-formatted product analysis matching submission guidelines.</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 px-4 py-2 rounded-xl text-xs font-medium transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Report</span>
                </button>
                <button onClick={() => setIsReportOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Body */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-950 font-mono text-xs text-gray-300 select-text whitespace-pre leading-relaxed select-all">
              {reportText}
            </div>
            
          </div>
        </div>
      )}

      {/* LOADING OVERLAY STATE */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="relative flex flex-col items-center p-8 bg-[#0e1322] border border-gray-800/80 rounded-3xl max-w-xs shadow-2xl text-center">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <h3 className="font-semibold text-sm mb-1">AI Pipeline Running</h3>
            <p className="text-xs text-gray-400">{loadingMessage || "Please wait..."}</p>
            {loadingMessage && loadingMessage.includes("CSV") && (
              <button
                onClick={handleCancelPipeline}
                className="mt-4 px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 border border-red-900/35 hover:border-red-800/45 text-[10px] text-red-400 hover:text-red-300 font-semibold tracking-wider uppercase rounded-xl transition cursor-pointer"
              >
                Cancel Pipeline
              </button>
            )}
          </div>
        </div>
      )}

      {/* SUCCESS TOAST STATE */}
      {successToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-indigo-900 border border-indigo-500 text-indigo-100 text-xs px-4 py-3 rounded-xl shadow-xl shadow-indigo-950/40">
          <Check className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

    </div>
  );
}

// Sub-Component: Theme Card for board
function ThemeCard({ theme, onRename, onMerge, onOpenDrawer, onApprove, onReject, isRejected, uploadedFileName }) {
  const totalCount = theme.supporting_row_ids.length;
  const [showMatches, setShowMatches] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [expandedHistIds, setExpandedHistIds] = useState([]);
  const [expandedNoteIds, setExpandedNoteIds] = useState([]);

  const matchesCount = (theme.matched_historical_themes?.length || 0) + (theme.matched_product_notes?.length || 0);

  return (
    <div className={`glass-card rounded-2xl p-6 border text-sm flex flex-col justify-between transition-all duration-300 ${
      isRejected ? 'opacity-50 border-gray-800' : 'border-gray-800/60 hover:border-gray-700/80'
    }`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Today's File Scope Badge */}
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md tracking-wider ${
              theme.is_pattern 
                ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/30' 
                : 'bg-yellow-950/60 text-yellow-400 border border-yellow-900/30'
            }`}>
              {theme.is_pattern ? 'REPEATED PATTERN' : 'ISOLATED COMMENT'}
            </span>
            
            {/* Across Time Scope Badge */}
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md tracking-wider ${
              (theme.matched_historical_themes && theme.matched_historical_themes.length > 0)
                ? 'bg-sky-950/60 text-sky-400 border border-sky-900/30'
                : 'bg-slate-900 text-slate-400 border border-slate-850'
            }`}>
              {(theme.matched_historical_themes && theme.matched_historical_themes.length > 0) ? 'RECURRING USER PROBLEM' : 'NEW USER PROBLEM'}
            </span>
          </div>
          <span className="text-gray-400 font-mono text-xs bg-gray-900/40 px-2 py-0.5 rounded border border-gray-800/40 shrink-0">{theme.primary_product_area}</span>
        </div>

        {/* Card Body */}
        <div className="space-y-3 cursor-pointer group" onClick={onOpenDrawer}>
          <h3 className="font-semibold text-base text-gray-200 group-hover:text-indigo-400 transition-colors leading-snug">{theme.title}</h3>
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{theme.problem_statement}</p>
          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-indigo-400 group-hover:text-indigo-300 transition pt-2.5 border-t border-gray-850">
            <FileText className="w-4 h-4 text-indigo-400/80" />
            <span>Review {totalCount} supporting feedback citations ({uploadedFileName})...</span>
          </div>
        </div>

        {/* AI Matches Dropdown Trigger */}
        {matchesCount > 0 && (
          <div className="pt-1.5 border-t border-gray-850">
            <button 
              onClick={() => setShowMatches(!showMatches)}
              className="flex items-center justify-between w-full text-left text-sm font-bold text-indigo-400 hover:text-indigo-300 transition py-1"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Matching Past Themes & Releases ({matchesCount})</span>
              </span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${showMatches ? 'rotate-90 text-indigo-400' : 'text-gray-500'}`} />
            </button>
            
            {showMatches && (
              <div className="mt-2 space-y-3.5 p-3.5 bg-gray-950/60 border border-gray-800/80 rounded-xl animate-fadeIn text-xs md:text-sm">
                {/* Historical Themes matches */}
                {theme.matched_historical_themes && theme.matched_historical_themes.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] text-amber-500/90 font-bold uppercase tracking-wider block">Historical Themes ({theme.matched_historical_themes.length})</span>
                    {theme.matched_historical_themes.map(hist => {
                      const isExpanded = expandedHistIds.includes(hist.id);
                      return (
                        <div 
                          key={hist.id}
                          onClick={() => setExpandedHistIds(prev => 
                            prev.includes(hist.id) ? prev.filter(id => id !== hist.id) : [...prev, hist.id]
                          )}
                          className="p-2.5 rounded-lg bg-amber-950/10 hover:bg-amber-950/20 border border-amber-900/20 hover:border-amber-800/40 transition cursor-pointer group/item"
                        >
                          <div className="flex items-start gap-2.5 text-amber-400">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-amber-500/80 block font-normal leading-none uppercase text-[9px] tracking-wider">Historical Theme Match</span>
                                <span className="text-[9px] text-amber-400/60 font-medium group-hover/item:text-amber-300 transition">{isExpanded ? 'Hide Description ▲' : 'Click to view description ▼'}</span>
                              </div>
                              <span className="font-semibold text-amber-100 group-hover/item:text-white transition text-xs md:text-sm leading-normal block">{hist.title}</span>
                              {isExpanded && hist.problem_statement && (
                                <p className="text-xs text-amber-200/80 leading-relaxed font-normal mt-2 p-2.5 bg-amber-950/40 rounded border border-amber-900/30 animate-fadeIn">
                                  {hist.problem_statement}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {theme.matched_historical_themes && theme.matched_historical_themes.length > 0 && theme.matched_product_notes && theme.matched_product_notes.length > 0 && (
                  <div className="border-t border-gray-800/50 my-1" />
                )}

                {/* Product notes matches */}
                {theme.matched_product_notes && theme.matched_product_notes.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] text-emerald-500/90 font-bold uppercase tracking-wider block">Product Release Notes ({theme.matched_product_notes.length})</span>
                    {theme.matched_product_notes.map(note => {
                      const isExpanded = expandedNoteIds.includes(note.id);
                      return (
                        <div 
                          key={note.id}
                          onClick={() => setExpandedNoteIds(prev => 
                            prev.includes(note.id) ? prev.filter(id => id !== note.id) : [...prev, note.id]
                          )}
                          className="p-2.5 rounded-lg bg-emerald-950/10 hover:bg-emerald-950/20 border border-emerald-900/20 hover:border-emerald-800/40 transition cursor-pointer group/item"
                        >
                          <div className="flex items-start gap-2.5 text-emerald-400">
                            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-emerald-500/80 block font-normal leading-none uppercase text-[9px] tracking-wider">Related Product Note {note.type && `[${note.type}]`}</span>
                                <span className="text-[9px] text-emerald-400/60 font-medium group-hover/item:text-emerald-300 transition">{isExpanded ? 'Hide Description ▲' : 'Click to view description ▼'}</span>
                              </div>
                              <span className="font-semibold text-emerald-100 group-hover/item:text-white transition text-xs md:text-sm leading-normal block">{note.title}</span>
                              {note.date && (
                                <span className="text-[10px] text-emerald-300/60 block font-mono mt-0.5 font-medium">Released: {formatDate(note.date)}</span>
                              )}
                              {isExpanded && note.description && (
                                <p className="text-xs text-emerald-200/80 leading-relaxed font-normal mt-2 p-2.5 bg-emerald-950/40 rounded border border-emerald-900/30 animate-fadeIn">
                                  {note.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Deterministic Metrics Collapsible Dropdown */}
        {!isRejected && (
          <div className="pt-1.5 border-t border-gray-850">
            <button 
              onClick={() => setShowMetrics(!showMetrics)}
              className="flex items-center justify-between w-full text-left text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition py-1"
            >
              <span className="flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Statistics & Timeline Graph</span>
              </span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${showMetrics ? 'rotate-90 text-indigo-400' : 'text-gray-500'}`} />
            </button>
            
            {showMetrics && (
              <div className="mt-2 space-y-4.5 p-4 bg-gray-900/35 border border-gray-800/80 rounded-xl animate-fadeIn text-xs">
                
                {/* Source Split Details */}
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Source Distribution</span>
                  <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden flex">
                    {Object.entries(theme.source_distribution || {}).map(([sourceName, count], idx) => {
                      const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-teal-500"];
                      const color = colors[idx % colors.length];
                      const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                      return (
                        <div key={sourceName} className={`h-full ${color}`} style={{ width: `${pct}%` }} title={sourceName} />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 font-mono">
                    {Object.entries(theme.source_distribution || {}).map(([sourceName, count], idx) => {
                      const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-cyan-500", "bg-teal-500"];
                      const color = colors[idx % colors.length];
                      return (
                        <span key={sourceName} className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
                          {sourceName} ({count})
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* User Type Split Details */}
                <div className="space-y-2 pt-3 border-t border-gray-850/50">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">User Type Allocation</span>
                  <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden flex">
                    {Object.entries(theme.user_type_distribution || {}).map(([typeName, count], idx) => {
                      const colors = ["bg-cyan-500", "bg-purple-500", "bg-amber-500", "bg-indigo-500", "bg-emerald-500", "bg-rose-500", "bg-teal-500"];
                      const color = colors[idx % colors.length];
                      const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                      return (
                        <div key={typeName} className={`h-full ${color}`} style={{ width: `${pct}%` }} title={typeName} />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 font-mono">
                    {Object.entries(theme.user_type_distribution || {}).map(([typeName, count], idx) => {
                      const colors = ["bg-cyan-500", "bg-purple-500", "bg-amber-500", "bg-indigo-500", "bg-emerald-500", "bg-rose-500", "bg-teal-500"];
                      const color = colors[idx % colors.length];
                      return (
                        <span key={typeName} className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
                          {typeName} ({count})
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Frequency Resampled Timeline Graph */}
                <div className="space-y-2 pt-3 border-t border-gray-850/50">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Feedback Timeline Frequency</span>
                  <div className="space-y-2 font-mono text-[10px]">
                    {Object.entries(theme.frequency).map(([month, count]) => {
                      const pct = Math.max(5, (count / totalCount) * 100);
                      return (
                        <div key={month} className="flex items-center gap-3 text-gray-300">
                          <span className="w-20 text-gray-400 shrink-0 text-left truncate">{month}</span>
                          <div className="flex-1 bg-gray-950 h-2.5 rounded overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-4 text-right font-bold text-gray-200 shrink-0">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>

      {/* Action Footer Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-800/60 mt-5 gap-2">
        <div className="flex items-center gap-2">
          {onRename && (
            <button 
              onClick={onRename} 
              className="text-gray-400 hover:text-white p-2 rounded-xl bg-gray-900/20 border border-gray-850 hover:bg-gray-800 transition" 
              title="Rename Theme"
            >
              <Edit3 className="w-4 h-4 text-indigo-400" />
            </button>
          )}
          {onMerge && (
            <button 
              onClick={onMerge} 
              className="text-gray-400 hover:text-white p-2 rounded-xl bg-gray-900/20 border border-gray-850 hover:bg-gray-800 transition" 
              title="Merge with Another Theme"
            >
              <GitMerge className="w-4 h-4 text-indigo-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onReject && (
            <button 
              onClick={onReject}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-white border border-red-500/20 bg-red-950/10 hover:bg-red-600 px-3.5 py-2 rounded-xl transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
          )}
          {onApprove && (
            <button 
              onClick={onApprove}
              className="flex items-center gap-1.5 text-xs text-green-400 hover:text-white border border-green-500/20 bg-green-950/10 hover:bg-green-600 px-3.5 py-2 rounded-xl transition font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
