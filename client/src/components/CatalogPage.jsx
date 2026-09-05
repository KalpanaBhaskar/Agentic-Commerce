import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CatalogPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/catalog')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Catalog fetch error:', err);
        setError('Failed to load catalog: ' + err.message);
        setLoading(false);
      });
  }, []);

  const formatPrice = (paise) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#E0E0E0]">
        <header className="border-b border-gray-700 px-6 py-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <Link 
              to="/"
              className="text-[#4FC3F7] hover:underline font-medium"
            >
              ← Back to Home
            </Link>
            <h1 className="text-xl font-bold text-[#4FC3F7]">Product Catalog</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center text-gray-400">Loading catalog...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#E0E0E0]">
        <header className="border-b border-gray-700 px-6 py-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <Link 
              to="/"
              className="text-[#4FC3F7] hover:underline font-medium"
            >
              ← Back to Home
            </Link>
            <h1 className="text-xl font-bold text-[#4FC3F7]">Product Catalog</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center text-red-400">{error}</div>
        </main>
      </div>
    );
  }

  const categories = [...new Set(products.map(p => p.category))];

  return (
    <div className="min-h-screen bg-[#121212] text-[#E0E0E0]">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link 
            to="/"
            className="text-[#4FC3F7] hover:underline font-medium"
          >
            ← Back to Home
          </Link>
          <h1 className="text-xl font-bold text-[#4FC3F7]">Product Catalog</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Browse Our Products</h2>
          <p className="text-gray-400">
            Explore our complete catalog of electronics, accessories, and apparel. 
            Each product is AI-optimized for agent parsing and includes comprehensive metadata.
          </p>
        </div>

        {categories.map(category => (
          <div key={category} className="mb-12">
            <h3 className="text-xl font-semibold mb-4 capitalize">{category}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products
                .filter(p => p.category === category)
                .map(product => (
                  <div key={product.id} className="border border-gray-700 p-6 hover:border-[#4FC3F7] transition-colors">
                    {product.image_url && (
                      <img 
                        src={product.image_url} 
                        alt={product.name} 
                        className="w-full h-48 object-cover rounded mb-4"
                      />
                    )}
                    <h4 className="text-lg font-semibold mb-2">{product.name}</h4>
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{product.description}</p>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[#4FC3F7] font-bold">{formatPrice(product.price_paise)}</span>
                      <span className="text-xs text-gray-500">Stock: {product.stock}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {product.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-gray-700 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {product.upsell_ids && product.upsell_ids.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Related products: {product.upsell_ids.length}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}

        <div className="mt-12 border border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Catalog Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">Total Products</h4>
              <p className="text-gray-400">{products.length} items</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Categories</h4>
              <p className="text-gray-400">{categories.length} categories</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Price Range</h4>
              <p className="text-gray-400">
                {formatPrice(Math.min(...products.map(p => p.price_paise)))} - {formatPrice(Math.max(...products.map(p => p.price_paise)))}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CatalogPage;