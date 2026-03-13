import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { getEbooks, uploadEbook, downloadEbook, convertEbook, deleteEbook } from '../api';
import './Library.css';

function Library() {
  const [ebooks, setEbooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(null);
  const [uploadData, setUploadData] = useState({ title: '', author: '' });

  useEffect(() => {
    fetchEbooks();
  }, []);

  const fetchEbooks = async (searchQuery = '') => {
    setLoading(true);
    try {
      const response = await getEbooks(searchQuery);
      setEbooks(response.data);
    } catch (err) {
      console.error('Failed to fetch ebooks');
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchEbooks(search);
  };

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setUploading(true);
    
    try {
      await uploadEbook(file, uploadData.title || file.name, uploadData.author);
      setUploadData({ title: '', author: '' });
      fetchEbooks(search);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    }
    
    setUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/epub+zip': ['.epub'],
      'application/x-mobipocket-ebook': ['.mobi']
    },
    multiple: false
  });

  const handleDownload = async (ebook) => {
    try {
      const response = await downloadEbook(ebook.id);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = ebook.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed. Please try again.');
    }
  };

  const handleConvert = async (ebook) => {
    if (ebook.file_format !== 'pdf') {
      alert('Only PDF files can be converted to EPUB');
      return;
    }
    
    setConverting(ebook.id);
    try {
      await convertEbook(ebook.id);
      fetchEbooks(search);
      alert('Conversion successful! New EPUB added to library.');
    } catch (err) {
      alert('Conversion failed: ' + (err.response?.data?.message || err.message));
    }
    setConverting(null);
  };

  const handleDelete = async (ebook) => {
    if (!confirm('Are you sure you want to delete this ebook?')) return;
    
    try {
      await deleteEbook(ebook.id);
      fetchEbooks(search);
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="library-container">
      <header className="library-header">
        <h1>My Ebook Library</h1>
        <button onClick={handleLogout} className="btn-secondary">Logout</button>
      </header>

      <div className="library-content">
        <aside className="sidebar">
          <div className="upload-section">
            <h3>Upload Ebook</h3>
            
            <div className="upload-form">
              <input
                type="text"
                placeholder="Title (optional)"
                value={uploadData.title}
                onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
              />
              <input
                type="text"
                placeholder="Author (optional)"
                value={uploadData.author}
                onChange={(e) => setUploadData({ ...uploadData, author: e.target.value })}
              />
            </div>
            
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              {uploading ? (
                <p>Uploading...</p>
              ) : isDragActive ? (
                <p>Drop the file here...</p>
              ) : (
                <p>Drag & drop a PDF/EPUB/MOBI file here, or click to select</p>
              )}
            </div>
          </div>
        </aside>

        <main className="main-content">
          <div className="search-bar">
            <form onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search by title or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn-primary">Search</button>
            </form>
          </div>

          {loading ? (
            <div className="loading">Loading...</div>
          ) : ebooks.length === 0 ? (
            <div className="empty-state">
              <p>No ebooks found. Upload your first ebook to get started!</p>
            </div>
          ) : (
            <div className="ebook-grid">
              {ebooks.map((ebook) => (
                <div key={ebook.id} className="ebook-card">
                  <div className="ebook-icon">
                    {ebook.file_format.toUpperCase()}
                  </div>
                  <div className="ebook-info">
                    <h3>{ebook.title}</h3>
                    {ebook.author && <p className="author">by {ebook.author}</p>}
                    <p className="meta">
                      {ebook.file_format.toUpperCase()} • {formatFileSize(ebook.file_size)}
                    </p>
                  </div>
                  <div className="ebook-actions">
                    <button
                      onClick={() => handleDownload(ebook)}
                      className="btn-primary"
                    >
                      Download
                    </button>
                    {ebook.file_format === 'pdf' && (
                      <button
                        onClick={() => handleConvert(ebook)}
                        className="btn-secondary"
                        disabled={converting === ebook.id}
                      >
                        {converting === ebook.id ? 'Converting...' : 'Convert to EPUB'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(ebook)}
                      className="btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Library;
