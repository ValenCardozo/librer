const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Base de datos
const DB_FILE = '/app/data/books.json';

// 🎯 ENDPOINT: Obtener todos los libros con estadísticas detalladas
app.get('/api/admin/books', (req, res) => {
    try {
        const books = JSON.parse(fs.readFileSync(DB_FILE));
        
        // Estadísticas avanzadas
        const stats = {
            totalBooks: books.length,
            totalSize: books.reduce((sum, book) => sum + parseFloat(book.size), 0).toFixed(2),
            byMonth: getBooksByMonth(books),
            recentUploads: books.slice(-5).reverse()
        };

        res.json({ books, stats });
    } catch (error) {
        console.error('Error:', error);
        res.json({ books: [], stats: {} });
    }
});

// 🎯 ENDPOINT: Eliminar libro
app.delete('/api/admin/books/:id', (req, res) => {
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
        res.json({ success: false, message: 'Error eliminando libro' });
    }
});

// 🎯 ENDPOINT: Actualizar información del libro
app.put('/api/admin/books/:id', (req, res) => {
    try {
        const bookId = req.params.id;
        const { title, author } = req.body;
        
        const books = JSON.parse(fs.readFileSync(DB_FILE));
        const bookIndex = books.findIndex(book => book.id === bookId);
        
        if (bookIndex === -1) {
            return res.json({ success: false, message: 'Libro no encontrado' });
        }

        // Actualizar información
        if (title) books[bookIndex].title = title;
        if (author) books[bookIndex].author = author;
        books[bookIndex].lastModified = new Date().toISOString();

        fs.writeFileSync(DB_FILE, JSON.stringify(books, null, 2));

        res.json({ success: true, message: 'Libro actualizado', book: books[bookIndex] });

    } catch (error) {
        res.json({ success: false, message: 'Error actualizando libro' });
    }
});

// Función auxiliar: Libros por mes
function getBooksByMonth(books) {
    const months = {};
    books.forEach(book => {
        const date = new Date(book.uploadDate);
        const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!months[monthYear]) {
            months[monthYear] = 0;
        }
        months[monthYear]++;
    });
    return months;
}

// Servir el panel de administración
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚙️ Panel de Administración ejecutándose en puerto ${PORT}`);
});
