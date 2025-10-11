import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/layout';
import { useAuth } from '../hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  AlertCircle,
  Folder,
  FolderTree
} from 'lucide-react';

interface ProductCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  parent_id?: string | null;
  is_active: boolean;
  metadata?: any;
  created_at: string;
  updated_at: string;
  children?: ProductCategory[];
}

const ProductsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Check if user has admin/manager permissions
  const canManageProducts = user?.is_admin === true || user?.is_manager === true;

  // State
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    parent_id: null as string | null,
  });

  // Redirect if no permissions
  React.useEffect(() => {
    if (!authLoading && user && !canManageProducts) {
      router.push('/dashboard');
    }
  }, [user, canManageProducts, authLoading, router]);

  // Fetch product categories
  const { data: categoriesResponse, isLoading } = useQuery({
    queryKey: ['product-categories', showInactive],
    queryFn: async () => {
      const response = await api.get('/product-categories', {
        params: { include_inactive: showInactive }
      });
      return response.data;
    },
    enabled: canManageProducts && !authLoading
  });

  const categories: ProductCategory[] = categoriesResponse?.categories || [];

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/product-categories', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setShowModal(false);
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to create category');
    }
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await api.put(`/product-categories/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setShowModal(false);
      setEditingCategory(null);
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to update category');
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/product-categories/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to delete category');
    }
  });

  // Helper functions
  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      parent_id: null,
    });
  };

  const handleEdit = (category: ProductCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      code: category.code,
      description: category.description || '',
      parent_id: category.parent_id || null,
    });
    setShowModal(true);
  };

  const handleDelete = async (category: ProductCategory) => {
    if (category.children && category.children.length > 0) {
      alert('Cannot delete category with subcategories. Please delete or move subcategories first.');
      return;
    }

    if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
      deleteCategoryMutation.mutate(category.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createCategoryMutation.mutate(formData);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Filter categories by search query
  const filterCategories = (cats: ProductCategory[]): ProductCategory[] => {
    if (!searchQuery) return cats;

    const query = searchQuery.toLowerCase();
    return cats.filter(cat => {
      const matchesSearch =
        cat.name.toLowerCase().includes(query) ||
        cat.code.toLowerCase().includes(query) ||
        (cat.description && cat.description.toLowerCase().includes(query));

      // Also include if any children match
      const childrenMatch = cat.children && filterCategories(cat.children).length > 0;

      return matchesSearch || childrenMatch;
    }).map(cat => ({
      ...cat,
      children: cat.children ? filterCategories(cat.children) : []
    }));
  };

  const filteredCategories = filterCategories(categories);

  // Get flat list of categories for parent selection dropdown
  const flattenCategories = (cats: ProductCategory[], level = 0): Array<{ category: ProductCategory; level: number }> => {
    const result: Array<{ category: ProductCategory; level: number }> = [];
    cats.forEach(cat => {
      result.push({ category: cat, level });
      if (cat.children && cat.children.length > 0) {
        result.push(...flattenCategories(cat.children, level + 1));
      }
    });
    return result;
  };

  const flatCategories = flattenCategories(categories);

  // Render category tree
  const renderCategory = (category: ProductCategory, level = 0) => {
    const isExpanded = expandedCategories.has(category.id);
    const hasChildren = category.children && category.children.length > 0;

    return (
      <div key={category.id} className={level > 0 ? 'ml-6' : ''}>
        <div className={`px-4 py-3 border-b border-gray-200 hover:bg-gray-50 ${!category.is_active ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              {/* Expand/Collapse button */}
              {hasChildren ? (
                <button
                  onClick={() => toggleExpanded(category.id)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}

              {/* Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                level === 0 ? 'bg-indigo-100' : 'bg-gray-100'
              }`}>
                {hasChildren ? (
                  <FolderTree className={`w-4 h-4 ${level === 0 ? 'text-indigo-600' : 'text-gray-600'}`} />
                ) : (
                  <Package className={`w-4 h-4 ${level === 0 ? 'text-indigo-600' : 'text-gray-600'}`} />
                )}
              </div>

              {/* Category Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {category.name}
                  </p>
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                    {category.code}
                  </span>
                  {!category.is_active && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                {category.description && (
                  <p className="text-xs text-gray-500 mt-1">{category.description}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleEdit(category)}
                className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDelete(category)}
                className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-red-600 bg-white hover:bg-red-50"
                disabled={hasChildren}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Render children */}
        {isExpanded && hasChildren && (
          <div className="border-l-2 border-gray-200">
            {category.children!.map(child => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (authLoading) {
    return <Layout>Loading...</Layout>;
  }

  if (!canManageProducts) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Categories</h1>
            <p className="text-gray-600 mt-1">Manage product categories for category-specific targets</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingCategory(null);
              setShowModal(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm font-medium text-gray-700">Show inactive</span>
          </label>
        </div>

        {/* Categories List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading categories...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {filteredCategories.length} {filteredCategories.length === 1 ? 'Category' : 'Categories'}
              </h3>
            </div>
            <div>
              {filteredCategories.length > 0 ? (
                filteredCategories.map(category => renderCategory(category))
              ) : (
                <div className="px-6 py-12 text-center">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery ? 'No categories found' : 'No categories yet'}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {searchQuery
                      ? 'Try adjusting your search query'
                      : 'Get started by creating your first product category'
                    }
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => {
                        resetForm();
                        setEditingCategory(null);
                        setShowModal(true);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Category
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., SOFT, HARD, SERV"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier for this category</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              {/* Parent Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Category (Optional)
                </label>
                <select
                  value={formData.parent_id || ''}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None (Top Level)</option>
                  {flatCategories
                    .filter(({ category }) =>
                      !editingCategory || category.id !== editingCategory.id
                    )
                    .map(({ category, level }) => (
                      <option key={category.id} value={category.id}>
                        {'—'.repeat(level)} {category.name}
                      </option>
                    ))
                  }
                </select>
                <p className="text-xs text-gray-500 mt-1">Create a subcategory by selecting a parent</p>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCategory(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editingCategory ? 'Update' : 'Create'} Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProductsPage;
