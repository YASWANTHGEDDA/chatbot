// client/src/components/AcademicSearchTool.js
import React, { useState, useEffect } from 'react';
import { searchCoreApi, searchCombinedAcademic, getProxiedFileDownloadUrl } from '../../services/api'; // Adjust path if needed
import '../AcademicSearchTool.css'; // Import the CSS

const AcademicSearchTool = () => {
    const [query, setQuery] = useState('');
    const [searchSource, setSearchSource] = useState('combined'); // 'core' or 'combined'
    
    // CORE specific
    const [maxPagesCore, setMaxPagesCore] = useState(1);
    const [downloadPdfsCore, setDownloadPdfsCore] = useState(false);
    
    // Combined specific (can also apply to single sources if UI is adapted)
    const [minYear, setMinYear] = useState('');
    const [openAlexMax, setOpenAlexMax] = useState(5);
    const [scholarMax, setScholarMax] = useState(3);

    const [results, setResults] = useState(null); // Stores the entire response object
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Effect to clear results when searchSource changes to avoid confusion
    useEffect(() => {
        setResults(null);
        setError('');
    }, [searchSource]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) {
            setError('Please enter a search query.');
            return;
        }
        setIsLoading(true);
        setError('');
        setResults(null);

        try {
            let response;
            if (searchSource === 'core') {
                response = await searchCoreApi(query, parseInt(maxPagesCore) || 1, downloadPdfsCore);
            } else { // 'combined'
                const params = {
                    query,
                    openalex_max_records: parseInt(openAlexMax) || 5,
                    scholar_max_results: parseInt(scholarMax) || 3,
                };
                if (minYear.trim() !== '') {
                    params.min_year = minYear.trim();
                }
                response = await searchCombinedAcademic(params);
            }
            setResults(response); // response contains { message, results_count, data, output_directory }
            if (response.data && response.data.length === 0) {
                setError('No results found for your query.');
            }
            console.log('Search Response:', response);
        } catch (err) {
            console.error("Search error:", err);
            setError(err.message || 'Failed to perform search. Please check the console and server logs.');
            setResults({ message: "Search failed", results_count: 0, data: [] }); // Ensure results.data is an array
        } finally {
            setIsLoading(false);
        }
    };
    
    const getRelativePathForDownload = (absoluteServerPath, baseOutputDirName, subDir) => {
        // Example: absoluteServerPath = "D:\\Chatbot-main\\server\\data_outputs\\core_academic_search\\core_pdfs\\some_file.pdf"
        //          baseOutputDirName = "core_academic_search" (this would be config.CORE_OUTPUT_DIR_NAME from python .env)
        //          subDir = "core_pdfs"
        // We want "core_academic_search/core_pdfs/some_file.pdf"
        if (!absoluteServerPath) return null;
        const parts = absoluteServerPath.split(/[\\/]/); // Split by / or \
        const fileName = parts.pop();
        const subDirInPath = parts.pop();
        const baseDirInPath = parts.pop();

        if (baseDirInPath === baseOutputDirName && subDirInPath === subDir) {
            return `${baseOutputDirName}/${subDir}/${fileName}`;
        }
        // Fallback if path structure is unexpected, might need more robust parsing or better data from backend
        console.warn("Could not reliably construct relative path for download:", absoluteServerPath);
        return null; 
    };


    return (
        <div className="academic-search-tool">
            <h2>Academic Paper Search</h2>
            <form onSubmit={handleSearch}>
                <div>
                    <label htmlFor="query">Search Query:</label>
                    <input
                        type="text"
                        id="query"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g., machine learning applications"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="searchSource">Source:</label>
                    <select
                        id="searchSource"
                        value={searchSource}
                        onChange={(e) => setSearchSource(e.target.value)}
                    >
                        <option value="combined">Combined (OpenAlex & Scholar)</option>
                        <option value="core">CORE Repository</option>
                    </select>
                </div>

                {searchSource === 'core' && (
                    <>
                        <div>
                            <label htmlFor="maxPagesCore">Max Pages (CORE):</label>
                            <input
                                type="number" id="maxPagesCore" value={maxPagesCore}
                                min="1" onChange={(e) => setMaxPagesCore(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="downloadPdfsCore">Download PDFs (CORE):</label>
                            <input
                                type="checkbox" id="downloadPdfsCore"
                                checked={downloadPdfsCore} onChange={(e) => setDownloadPdfsCore(e.target.checked)}
                            />
                        </div>
                    </>
                )}

                {searchSource === 'combined' && (
                    <>
                        <div>
                            <label htmlFor="minYearCombined">Min. Year (Optional):</label>
                            <input
                                type="number" id="minYearCombined" placeholder="e.g., 2022"
                                value={minYear} onChange={(e) => setMinYear(e.target.value)}
                            />
                        </div>
                         <div>
                            <label htmlFor="openAlexMax">OpenAlex Max:</label>
                            <input type="number" id="openAlexMax" value={openAlexMax} min="1" onChange={(e) => setOpenAlexMax(e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="scholarMax">Scholar Max:</label>
                            <input type="number" id="scholarMax" value={scholarMax} min="1" onChange={(e) => setScholarMax(e.target.value)} />
                        </div>
                    </>
                )}

                <button type="submit" disabled={isLoading} style={{ marginTop: '15px' }}>
                    {isLoading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {error && <p className="error-message">{error}</p>}

            {results && (
                <div className="results-section">
                    <h3>{results.message || `Found ${results.results_count || 0} results`}</h3>
                    {results.output_directory && <p className="info-message"><small>Output (metadata CSV) saved in backend at: {results.output_directory}</small></p>}
                    
                    {results.data && results.data.length > 0 ? (
                        <ul>
                            {results.data.map((item, index) => {
                                // For CORE PDF downloads, construct the relative path for getProxiedFileDownloadUrl
                                let pdfDownloadLink = null;
                                if (item.source === 'CORE' && item.local_filename && downloadPdfsCore) {
                                    // Assuming item.local_filename is an absolute path on the server like:
                                    // D:\Chatbot-main\server\data_outputs\core_academic_search\core_pdfs\1_0_SomeTitle.pdf
                                    // We need to make it relative to OUTPUT_BASE_DIR for the proxy.
                                    // This requires knowing the structure. A better way is for Python to return this relative path.
                                    // For now, a heuristic:
                                    const relativePath = getRelativePathForDownload(item.local_filename, "core_academic_search", "core_pdfs");
                                    if (relativePath) {
                                        pdfDownloadLink = getProxiedFileDownloadUrl(relativePath);
                                    }
                                }

                                return (
                                    <li key={item.title + index + item.source} className="result-item">
                                        <h4>{item.title || 'No Title'}</h4>
                                        <p><strong>Source:</strong> {item.source || 'N/A'}</p>
                                        {item.year && !String(item.year).toLowerCase().includes('nan') && <p><strong>Year:</strong> {item.year}</p>}
                                        {item.citations !== undefined && <p><strong>Citations:</strong> {item.citations}</p>}
                                        <p className="abstract"><strong>Abstract:</strong> {item.abstract ? item.abstract.substring(0, 300) + '...' : 'N/A'}</p>
                                        {pdfDownloadLink && (
                                            <a
                                                href={pdfDownloadLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download // Suggests download to browser
                                            >
                                                Download PDF (from CORE)
                                            </a>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        !isLoading && <p className="info-message">No papers found matching your criteria.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default AcademicSearchTool;

// client/src/components/tools/AcademicSearchToolContent.js
// import React from 'react';

// const AcademicSearchToolContent = ({ onResults, initialData }) => {
//     const handleDummyAction = () => {
//         // Simulate getting some results and calling the callback
//         console.log("AcademicSearchToolContent: Dummy action triggered.");
//         if (onResults) {
//             onResults({ 
//                 tool: 'academicSearch', 
//                 query: 'test query', 
//                 count: 2, 
//                 topItems: [
//                     { title: 'Dummy Paper 1', source: 'Test Source', year: '2024' },
//                     { title: 'Dummy Paper 2', source: 'Test Source', year: '2023' }
//                 ],
//                 error: null 
//             });
//         }
//     };

//     return (
//         <div className="tool-content-panel">
//             <h3>Academic Search (Placeholder)</h3>
//             <p>Academic search tool content will go here.</p>
//             <p>Initial Data (if any): {JSON.stringify(initialData)}</p>
//             <button onClick={handleDummyAction}>Simulate Search & Post to Chat</button>
//         </div>
//     );
// };
// export default AcademicSearchToolContent;