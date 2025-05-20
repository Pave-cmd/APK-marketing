// Simple Express server as fallback for Heroku
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

console.log('Starting simple fallback server...');

// Serve static files
app.use(express.static('src/public'));

// Simple landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>BekpaShop - Ve výstavbě</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          height: 100vh; 
          margin: 0;
          background-color: #f8f9fa;
        }
        .container {
          text-align: center;
          padding: 2rem;
          max-width: 600px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .btn {
          display: inline-block;
          padding: 10px 20px;
          background-color: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>BekpaShop</h1>
        <p>Pracujeme na spuštění nové verze webu.</p>
        <div class="my-5">
          <div class="spinner-border text-primary mb-4" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted mb-5">Děkujeme za trpělivost.</p>
        </div>
        <a href="/dashboard" class="btn btn-primary btn-lg px-5">Pokračovat</a>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
  `);
});

// Redirect all other requests to homepage
app.get('*', (req, res) => {
  res.redirect('/');
});

// Start server
app.listen(port, () => {
  console.log(`Fallback server running on port ${port}`);
});