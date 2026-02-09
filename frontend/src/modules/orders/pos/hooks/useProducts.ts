
import { useState, useEffect } from 'react';
import { type Product, productService } from '../../../../services/productService';
import { getErrorMessage } from '../../../../lib/errorUtils';
import { offlineDb } from '../../../../lib/offlineDb';

export const useProducts = (categoryId?: number, isActive?: boolean) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [categoryId, isActive]);

  const fetchProducts = async () => {
    console.log('[useProducts] fetchProducts called');
    try {
      setLoading(true);
      setError(null);

      // Always try API first (navigator.onLine is unreliable for server availability)
      try {
        const data = await productService.getAll(categoryId, isActive);
        console.log('[useProducts] API success, got', data.length, 'products');
        setProducts(data);
        setIsOfflineData(false);
        return;
      } catch (err: unknown) {
        // API failed - fall through to offline cache
        console.log('[useProducts] ❌ API failed, falling back to IndexedDB cache');
      }

      // Offline mode: load from IndexedDB
      console.log('[useProducts] Loading from IndexedDB cache');
      let cachedProducts = await offlineDb.products.toArray();

      // Apply filters
      if (categoryId !== undefined) {
        cachedProducts = cachedProducts.filter(p => p.categoryId === categoryId);
      }
      if (isActive !== undefined) {
        cachedProducts = cachedProducts.filter(p => p.isActive === isActive);
      }

      if (cachedProducts.length > 0) {
        // Map offline format to Product format
        const mappedProducts: Product[] = cachedProducts.map(p => ({
          id: p.id,
          name: p.name,
          price: String(p.price),
          categoryId: p.categoryId,
          isActive: p.isActive,
          productType: p.productType as Product['productType'],
          modifierGroups: p.modifierGroups?.map(mg => ({
            id: mg.id,
            name: mg.name,
            minSelection: mg.minSelection,
            maxSelection: mg.maxSelection,
            options: mg.options?.map(o => ({
              id: o.id,
              name: o.name,
              price: String(o.price)
            })) || []
          })) || []
        }));
        setProducts(mappedProducts);
        setIsOfflineData(true);
        console.log('[useProducts] Loaded', mappedProducts.length, 'products from cache');
      } else {
        setError('Sin conexión y sin datos en caché. Conecte a internet para sincronizar.');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al cargar productos'));
    } finally {
      setLoading(false);
    }
  };

  return { products, loading, error, isOfflineData, refetch: fetchProducts };
};
