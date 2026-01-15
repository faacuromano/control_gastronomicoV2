import React from 'react';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from './ProductCard';
import { usePOSStore } from '../../../../store/pos.store';
import { Loader2 } from 'lucide-react';

interface ProductGridProps {
  activeCategoryId?: number;
  searchQuery?: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ activeCategoryId, searchQuery }) => {
  const { products, loading, error } = useProducts(activeCategoryId, true);
  const addToCart = usePOSStore((state) => state.addToCart);

  // Client-side filtering for search query (if API doesn't support it yet)
  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
    );
  }

  if (error) {
    return (
        <div className="flex h-full items-center justify-center text-red-500">
            {error}
        </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-1">
      {filteredProducts.map((product) => (
        <ProductCard 
            key={product.id} 
            product={product} 
            onClick={() => addToCart(product)} 
        />
      ))}
      {filteredProducts.length === 0 && (
          <div className="col-span-full h-40 flex items-center justify-center text-slate-400">
              No products found.
          </div>
      )}
    </div>
  );
};
