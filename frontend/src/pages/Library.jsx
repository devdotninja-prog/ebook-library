import { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjsLib from 'pdfjs-dist';
import { getEbooks, uploadEbook, downloadEbook, convertEbook, deleteEbook } from '../api';
import './Library.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const BOOK_COLORS = [
  '#8B4513', '#2F4F4F', '#800020', '#1C3A5F', '#3D2B1F', 
  '#4A0E0E', '#2E4600', '#4B3621', '#5C4033', '#3B2F2F'
];

function Library() {
  const [ebooks, setEbooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(null);
  const [uploadData, setUploadData] = useState({ title: '', author: '' });
  const [selectedBook, setSelectedBook] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [readingBook, setReadingBook] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

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
      setShowUploadModal(false);
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

  const handleBulkDownload = async () => {
    for (const bookId of selectedBooks) {
      const book = ebooks.find(e => e.id === bookId);
      if (book) {
        await handleDownload(book);
      }
    }
    setSelectedBooks([]);
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
    if (!confirm('Are you sure you want to delete this book?')) return;
    
    try {
      await deleteEbook(ebook.id);
      setSelectedBook(null);
      setReadingBook(null);
      fetchEbooks(search);
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedBooks.length} books?`)) return;
    
    try {
      for (const bookId of selectedBooks) {
        await deleteEbook(bookId);
      }
      setSelectedBooks([]);
      fetchEbooks(search);
    } catch (err) {
      alert('Delete failed');
    }
  };

  const toggleSelectBook = (bookId) => {
    setSelectedBooks(prev => 
      prev.includes(bookId) 
        ? prev.filter(id => id !== bookId)
        : [...prev, bookId]
    );
  };

  const selectAllBooks = () => {
    if (selectedBooks.length === ebooks.length) {
      setSelectedBooks([]);
    } else {
      setSelectedBooks(ebooks.map(e => e.id));
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

  const getBookColor = (title) => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return BOOK_COLORS[Math.abs(hash) % BOOK_COLORS.length];
  };

  const loadPdf = async (book) => {
    setPdfLoading(true);
    setReadingBook(book);
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const url = `${apiUrl}/api/ebooks/${book.id}/view?t=${token}`;
      setPdfUrl(url);
    } catch (err) {
      console.error('Failed to load PDF:', err);
      alert('Failed to load PDF');
    }
    
    setPdfLoading(false);
  };

  const openBook = (ebook) => {
    if (ebook.file_format === 'pdf') {
      loadPdf(ebook);
    } else {
      setSelectedBook(ebook);
    }
  };

  return (
    <div className="library-container">
      <header className="library-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">📚</span>
            <h1>My Library</h1>
          </div>
        </div>
        <div className="header-right">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search collection..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit">🔍</button>
          </form>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="library-content">
        <aside className="sidebar">
          <div className="shelf-ornament">
            <div className="shelf-wood"></div>
            <div className="shelf-shadow"></div>
          </div>
          
          <button className="add-book-btn" onClick={() => setShowUploadModal(true)}>
            <span className="plus-icon">+</span>
            <span>Add Book</span>
          </button>

          {selectedBooks.length > 0 && (
            <div className="bulk-actions">
              <span className="selected-count">{selectedBooks.length} selected</span>
              <button className="bulk-btn download" onClick={handleBulkDownload}>
                📥 Download All
              </button>
              <button className="bulk-btn delete" onClick={handleBulkDelete}>
                🗑️ Delete All
              </button>
            </div>
          )}

          <div className="library-stats">
            <div className="stat">
              <span className="stat-number">{ebooks.length}</span>
              <span className="stat-label">Books</span>
            </div>
            <div className="stat">
              <span className="stat-number">{ebooks.filter(e => e.file_format === 'pdf').length}</span>
              <span className="stat-label">PDFs</span>
            </div>
            <div className="stat">
              <span className="stat-number">{ebooks.filter(e => e.file_format === 'epub').length}</span>
              <span className="stat-label">EPUBs</span>
            </div>
          </div>
        </aside>

        <main className="main-content">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading your library...</p>
            </div>
          ) : ebooks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-shelf">
                <div className="empty-book-placeholder"></div>
                <div className="empty-book-placeholder"></div>
                <div className="empty-book-placeholder"></div>
              </div>
              <h2>Your library is empty</h2>
              <p>Add your first book to start your collection</p>
              <button className="primary-btn" onClick={() => setShowUploadModal(true)}>
                Add Your First Book
              </button>
            </div>
          ) : (
            <>
              {selectedBooks.length > 0 && (
                <div className="selection-bar">
                  <label className="select-all">
                    <input 
                      type="checkbox" 
                      checked={selectedBooks.length === ebooks.length}
                      onChange={selectAllBooks}
                    />
                    Select All ({ebooks.length})
                  </label>
                  <span className="selection-info">
                    {selectedBooks.length} of {ebooks.length} selected
                  </span>
                </div>
              )}
              <div className="bookshelf">
                {ebooks.map((ebook) => (
                  <div 
                    key={ebook.id} 
                    className={`book ${selectedBooks.includes(ebook.id) ? 'selected' : ''}`}
                    style={{ '--book-color': getBookColor(ebook.title) }}
                    onClick={() => openBook(ebook)}
                  >
                    <div 
                      className="book-checkbox"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectBook(ebook.id);
                      }}
                    >
                      {selectedBooks.includes(ebook.id) ? '✓' : ''}
                    </div>
                    <div className="book-spine">
                      <span className="book-title">{ebook.title}</span>
                      {ebook.author && <span className="book-author">{ebook.author}</span>}
                    </div>
                    <div className="book-cover">
                      <div className="cover-content">
                        <span className="cover-format">{ebook.file_format.toUpperCase()}</span>
                        <span className="cover-title">{ebook.title}</span>
                        {ebook.file_format === 'pdf' && (
                          <span className="read-badge">📖 Read</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add New Book</h2>
            
            <div className="upload-form">
              <input
                type="text"
                placeholder="Book Title"
                value={uploadData.title}
                onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
              />
              <input
                type="text"
                placeholder="Author"
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
                <div className="dropzone-content">
                  <span className="dropzone-icon">📖</span>
                  <p>Drag & drop your book here</p>
                  <span className="dropzone-formats">PDF, EPUB, MOBI</span>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowUploadModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {selectedBook && (
        <div className="modal-overlay" onClick={() => setSelectedBook(null)}>
          <div className="book-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="detail-book" style={{ '--book-color': getBookColor(selectedBook.title) }}>
              <div className="detail-book-spine">
                <span>{selectedBook.title}</span>
              </div>
              <div className="detail-book-cover">
                <span className="format-badge">{selectedBook.file_format.toUpperCase()}</span>
              </div>
            </div>
            
            <div className="detail-info">
              <h2>{selectedBook.title}</h2>
              {selectedBook.author && <p className="detail-author">by {selectedBook.author}</p>}
              
              <div className="detail-meta">
                <span>Format: {selectedBook.file_format.toUpperCase()}</span>
                <span>Size: {formatFileSize(selectedBook.file_size)}</span>
              </div>

              <div className="detail-actions">
                <button 
                  className="action-btn download-btn"
                  onClick={() => handleDownload(selectedBook)}
                >
                  📥 Download
                </button>
                {selectedBook.file_format === 'pdf' && (
                  <button 
                    className="action-btn read-btn"
                    onClick={() => loadPdf(selectedBook)}
                  >
                    📖 Read Now
                  </button>
                )}
                <button 
                  className="action-btn delete-btn"
                  onClick={() => handleDelete(selectedBook)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
            
            <button className="close-btn" onClick={() => setSelectedBook(null)}>×</button>
          </div>
        </div>
      )}

      {readingBook && (
        <div className="pdf-reader-overlay">
          <div className="pdf-reader">
            <div className="pdf-header">
              <h2>{readingBook.title}</h2>
              <div className="pdf-controls">
                <button className="close-pdf-btn" onClick={() => {
                  setReadingBook(null);
                  setPdfUrl(null);
                }}>× Close</button>
              </div>
            </div>
            
            <div className="pdf-content">
              {pdfLoading ? (
                <div className="pdf-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading PDF...</p>
                </div>
              ) : pdfUrl ? (
                <iframe 
                  src={pdfUrl} 
                  title={readingBook.title}
                  className="pdf-iframe"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Library;
