
import { useState, useEffect } from 'react';
import { type Product, productService } from '../../../../services/productService';

export const useProducts = (categoryId?: number, isActive?: boolean) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [categoryId, isActive]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await productService.getAll(categoryId, isActive);
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  return { products, loading, error, refetch: fetchProducts };
};
