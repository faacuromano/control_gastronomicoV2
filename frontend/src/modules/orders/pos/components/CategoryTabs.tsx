import React from 'react';
import { useCategories } from '../hooks/useCategories';
import { cn } from '../../../../lib/utils'; // Assuming Shadcn utility exists
import { Coffee, Utensils, Beer, Wine, IceCream, Star } from 'lucide-react';

interface CategoryTabsProps {
  activeId?: number;
  onSelect: (id?: number) => void;
}

// Map icons roughly or random.
const Icons = [Coffee, Utensils, Beer, Wine, IceCream, Star];

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ activeId, onSelect }) => {
  const { categories } = useCategories();

  return (
    <div className="flex flex-col w-full gap-2 px-2">
      <button
        onClick={() => onSelect(undefined)}
        className={cn(
          "flex flex-col items-center justify-center p-3 rounded-xl transition-all",
          activeId === undefined 
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
            : "bg-white text-slate-600 hover:bg-slate-50"
        )}
      >
        <Star className="mb-1" size={20} />
        <span className="text-xs font-semibold">All</span>
      </button>

      {categories
        .filter((cat) => cat.id !== 1 && (cat.activeProductsCount || 0) > 0)
        .map((cat, idx) => {
        const Icon = Icons[idx % Icons.length];
        return (
            <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl transition-all",
                activeId === cat.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
            >
                <Icon className="mb-1" size={20} />
                <span className="text-xs font-semibold text-center leading-none">{cat.name}</span>
            </button>
        );
      })}
    </div>
  );
};
