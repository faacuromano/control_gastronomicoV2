import React from 'react';
import { useCategories } from '../hooks/useCategories';
import { cn } from '../../../../lib/utils';
import { LayoutGrid } from 'lucide-react';

interface CategoryTabsProps {
  activeId?: number;
  onSelect: (id?: number) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ activeId, onSelect }) => {
  const { categories } = useCategories();

  return (
    <div className="flex flex-col w-full gap-1.5 px-1.5">
      {/* All Categories - Primary Action */}
      <button
        onClick={() => onSelect(undefined)}
        className={cn(
          "flex flex-col items-center justify-center p-2 lg:p-2.5 rounded-lg transition-all",
          activeId === undefined
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <LayoutGrid size={20} className="mb-1" />
        <span className="text-[9px] font-semibold uppercase tracking-wide">Todo</span>
      </button>

      {/* Divider */}
      <div className="h-px bg-border mx-1 my-1" />

      {/* Category Buttons - Compact & Touch-Friendly */}
      {categories
        .filter((cat) => cat.id !== 1 && (cat.activeProductsCount || 0) > 0)
        .map((cat) => {
          const isActive = activeId === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={cn(
                "relative flex flex-col items-center justify-center p-2 lg:p-2.5 rounded-lg transition-all min-h-[60px]",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {/* Category Initial as Visual */}
              <div className={cn(
                "w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold mb-1",
                isActive ? "bg-primary-foreground/20" : "bg-muted"
              )}>
                {cat.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[9px] font-medium text-center leading-tight line-clamp-2 max-w-full">
                {cat.name}
              </span>

              {/* Count indicator */}
              {!isActive && (cat.activeProductsCount || 0) > 0 && (
                <span className="absolute top-1 right-1 text-[8px] text-muted-foreground/70">
                  {cat.activeProductsCount}
                </span>
              )}
            </button>
          );
        })}
    </div>
  );
};
