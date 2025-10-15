const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de Multer para uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/app/libros');
    },
    filename: (req, file, cb) => {
        // Sanitizar nombre de archivo
        const originalName = file.originalname;
        const safeName = originalName.replace(/[^a-zA-Z0-9.\-]/g, '_');
        cb(null, Date.now() + '_' + safeName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB límite
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'), false);
        }
    }
});

// Base de datos simple (JSON)
const DB_FILE = '/app/data/books.json';

// Inicializar base de datos
function initDB() {
    const dataDir = path.dirname(DB_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
}

// 🎯 ENDPOINT: Subir PDF
app.post('/api/upload', upload.single('pdf'), (req, res) => {
    try {
        if (!req.file) {
            return res.json({ success: false, message: 'No se seleccionó ningún archivo' });
        }

        const bookInfo = {
            id: Date.now().toString(),
            filename: req.file.filename,
            originalName: req.file.originalname,
            title: req.file.originalname.replace('.pdf', ''),
            size: (req.file.size / (1024 * 1024)).toFixed(2), // MB
            uploadDate: new Date().toISOString(),
            path: `/libros/${req.file.filename}`
        };

        // Guardar en base de datos
        const books = JSON.parse(fs.readFileSync(DB_FILE));
        books.push(bookInfo);
        fs.writeFileSync(DB_FILE, JSON.stringify(books, null, 2));

        console.log(`📚 Nuevo libro subido: ${bookInfo.title}`);

        res.json({
            success: true,
            message: `Libro "${bookInfo.title}" subido exitosamente`,
            book: bookInfo
        });

    } catch (error) {
        console.error('Error subiendo archivo:', error);
        res.json({ success: false, message: 'Error subiendo archivo: ' + error.message });
    }
});

// 🎯 ENDPOINT: Obtener todos los libros
app.get('/api/books', (req, res) => {
    try {
        const books = JSON.parse(fs.readFileSync(DB_FILE));
        res.json(books);
    } catch (error) {
        console.error('Error leyendo libros:', error);
        res.json([]);
    }
});

// 🎯 ENDPOINT: Obtener estadísticas
app.get('/api/stats', (req, res) => {
    try {
        const books = JSON.parse(fs.readFileSync(DB_FILE));
        const totalSize = books.reduce((sum, book) => sum + parseFloat(book.size), 0);
        
        res.json({
            totalBooks: books.length,
            totalSize: totalSize.toFixed(2),
            activeUsers: 1, // Para demo
            lastUpdate: new Date().toISOString()
        });
    } catch (error) {
        res.json({ totalBooks: 0, totalSize: 0, activeUsers: 0 });
    }
});

// 🎯 ENDPOINT: Eliminar libro
app.delete('/api/books/:id', (req, res) => {
    try {
        const bookId = req.params.id;
        const books = JSON.parse(fs.readFileSync(DB_FILE));
        const bookIndex = books.findIndex(book => book.id === bookId);
        
        if (bookIndex === -1) {
            return res.json({ success: false, message: 'Libro no encontrado' });
        }

        const book = books[bookIndex];
        
        // Eliminar archivo físico
        const filePath = path.join('/app/libros', book.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Eliminar de la base de datos
        books.splice(bookIndex, 1);
        fs.writeFileSync(DB_FILE, JSON.stringify(books, null, 2));

        res.json({ success: true, message: 'Libro eliminado exitosamente' });

    } catch (error) {
        res.json({ success: false, message: 'Error eliminando libro: ' + error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'upload-server', timestamp: new Date().toISOString() });
});

// Inicializar e iniciar servidor
initDB();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📁 Servidor de Upload ejecutándose en puerto ${PORT}`);
});
