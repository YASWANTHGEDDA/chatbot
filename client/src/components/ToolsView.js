import React, { useState } from 'react';
import WebPdfDownloaderToolContent from './tools/WebPdfDownloaderToolContent';
import AcademicSearchTool from './tools/AcademicSearchToolContent'; // Renamed to AcademicSearchToolContent for consistency
import MarkdownToPptTool from './tools/MarkdownToPptToolContent';
import MarkdownToDocToolContent from './tools/MarkdownToDocToolContent';
import OcrToolContent from './tools/OcrToolContent';
import YouTubeDownloaderToolContent from './tools/YoutubeDownloaderToolContent';
import './ToolsView.css'; // Import the new CSS file

const ToolsView = () => {
  const [activeTool, setActiveTool] = useState(null); // State to manage which tool is active

  const tools = [
    { id: 'webPdfDownloader', name: 'Web PDF Downloader', component: WebPdfDownloaderToolContent },
    { id: 'academicSearch', name: 'Academic Search', component: AcademicSearchTool },
    { id: 'markdownToPpt', name: 'Markdown to PowerPoint', component: MarkdownToPptTool },
    { id: 'markdownToDoc', name: 'Markdown to DOCX', component: MarkdownToDocToolContent },
    { id: 'ocrTool', name: 'OCR Tool', component: OcrToolContent },
    { id: 'youtubeDownloader', name: 'YouTube Downloader', component: YouTubeDownloaderToolContent },
  ];

  const ActiveToolComponent = activeTool ? tools.find(tool => tool.id === activeTool).component : null;

  return (
    <div className="tools-view-container">
      <div className="tools-sidebar">
        <h2>Tools</h2>
        <ul>
          {tools.map(tool => (
            <li key={tool.id}>
              <button
                className={activeTool === tool.id ? 'active' : ''}
                onClick={() => setActiveTool(tool.id)}
              >
                {tool.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="tools-content-area">
        {activeTool ? (
          <ActiveToolComponent />
        ) : (
          <p>Select a tool from the left sidebar to configure or use it.</p>
        )}
      </div>
    </div>
  );
};

export default ToolsView; 