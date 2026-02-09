
import { useState, useEffect } from 'react';
import { type Category, categoryService } from '../../../../services/categoryService';
import { getErrorMessage } from '../../../../lib/errorUtils';
import { offlineDb } from '../../../../lib/offlineDb';

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    console.log('[useCategories] fetchCategories called');
    try {
      setLoading(true);
      setError(null);

      // Always try API first (navigator.onLine is unreliable for server availability)
      try {
        const data = await categoryService.getAll();
        console.log('[useCategories] API success, got', data.length, 'categories');
        setCategories(data);
        setIsOfflineData(false);
        return;
      } catch (err: unknown) {
        // API failed - fall through to offline cache
        console.log('[useCategories] ❌ API failed, falling back to IndexedDB cache');
      }

      // Offline mode: load from IndexedDB
      console.log('[useCategories] Loading from IndexedDB cache');
      const cachedCategories = await offlineDb.categories.toArray();

      if (cachedCategories.length > 0) {
        const mappedCategories: Category[] = cachedCategories.map(c => ({
          id: c.id,
          name: c.name
        }));
        setCategories(mappedCategories);
        setIsOfflineData(true);
        console.log('[useCategories] Loaded', mappedCategories.length, 'categories from cache');
      } else {
        setError('Sin conexión y sin datos en caché.');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al cargar categorías'));
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading, error, isOfflineData, refetch: fetchCategories };
};
