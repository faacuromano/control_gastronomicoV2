import { useState, useEffect } from 'react';
import { categoryService, type Category } from '../../../../services/categoryService';
import { productService, type Product } from '../../../../services/productService';
import { X, Save } from 'lucide-react';

interface ProductFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    productToEdit?: Product;
}

export default function ProductForm({ isOpen, onClose, onSuccess, productToEdit }: ProductFormProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [productType, setProductType] = useState('SIMPLE');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadCategories();
            if (productToEdit) {
                setName(productToEdit.name);
                setPrice(productToEdit.price.toString());
                setCategoryId(productToEdit.categoryId.toString());
                setDescription(productToEdit.description || '');
                setProductType(productToEdit.productType);
            } else {
                resetForm();
            }
        }
    }, [isOpen, productToEdit]);

    const loadCategories = async () => {
        try {
            const data = await categoryService.getAll();
            setCategories(data);
        } catch (err) {
            console.error(err);
        }
    };

    const resetForm = () => {
        setName('');
        setPrice('');
        setCategoryId('');
        setDescription('');
        setProductType('SIMPLE');
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = {
                name,
                price: parseFloat(price),
                categoryId: parseInt(categoryId),
                description,
                productType,
                isActive: true,
                isStockable: true
            };

            if (productToEdit) {
                await productService.update(productToEdit.id, payload);
            } else {
                await productService.create(payload);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Failed to save product');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background w-full max-w-lg rounded-lg shadow-lg border border-border flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h2 className="text-xl font-semibold">{productToEdit ? 'Edit Product' : 'New Product'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-accent rounded-md">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Price</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type</label>
                            <select
                                value={productType}
                                onChange={(e) => setProductType(e.target.value)}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            >
                                <option value="SIMPLE">Simple</option>
                                <option value="COMBO">Combo</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <select
                            required
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md"
                        >
                            <option value="">Select Category</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md min-h-[80px]"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? 'Saving...' : 'Save Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
