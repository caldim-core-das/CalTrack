import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Tag, Loader2, Save, X } from "lucide-react"
import { apiRequest } from "../../../api/client.js"
import { Button, Input, Modal, Select } from "../../components/kit.jsx"

export default function CatalogSettingsSection({ showToast, SectionHeader }) {
  const [categories, setCategories] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  
  const fetchCatalog = async () => {
    setLoading(true)
    try {
      const catRes = await apiRequest("/settings/catalog/categories/")
      if (catRes.success) {
        setCategories(catRes.data)
        if (catRes.data.length > 0 && !selectedCategory) {
          setSelectedCategory(catRes.data[0])
        }
      }
    } catch (e) {
      showToast("Failed to load catalog", "error")
    }
    setLoading(false)
  }

  const fetchServices = async (catId) => {
    try {
      const srvRes = await apiRequest(`/settings/catalog/services/?category_id=${catId}`)
      if (srvRes.success) setServices(srvRes.data)
    } catch(e) {
      showToast("Failed to load services", "error")
    }
  }

  useEffect(() => {
    fetchCatalog()
  }, [])

  useEffect(() => {
    if (selectedCategory) fetchServices(selectedCategory.id)
  }, [selectedCategory])

  const handleSaveService = async (e) => {
    e.preventDefault()
    try {
      if (editingService.id) {
        await apiRequest(`/settings/catalog/services/${editingService.id}/`, { method: "PUT", json: editingService })
        showToast("Service updated successfully")
      } else {
        await apiRequest(`/settings/catalog/services/`, { method: "POST", json: { ...editingService, category: selectedCategory.id } })
        showToast("Service created successfully")
      }
      setEditingService(null)
      fetchServices(selectedCategory.id)
    } catch (e) {
      showToast("Failed to save service", "error")
    }
  }

  const handleSaveCategory = async (e) => {
    e.preventDefault()
    try {
      if (editingCategory.id) {
        const res = await apiRequest(`/settings/catalog/categories/${editingCategory.id}/`, { method: "PUT", json: editingCategory })
        showToast("Category updated successfully")
        if (selectedCategory?.id === editingCategory.id && res.success) {
          setSelectedCategory(res.data)
        }
      } else {
        const newSlug = editingCategory.slug || editingCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        await apiRequest(`/settings/catalog/categories/`, { method: "POST", json: { ...editingCategory, slug: newSlug } })
        showToast("Category created successfully")
      }
      setEditingCategory(null)
      fetchCatalog()
    } catch (e) {
      showToast("Failed to save category", "error")
    }
  }

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm("Are you sure you want to delete this category? All services under it will be deleted.")) return
    try {
      await apiRequest(`/settings/catalog/categories/${catId}/`, { method: "DELETE" })
      showToast("Category deleted successfully")
      if (selectedCategory?.id === catId) {
        setSelectedCategory(null)
      }
      fetchCatalog()
    } catch (e) {
      showToast("Failed to delete category", "error")
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <SectionHeader 
        title="Service Catalog" 
        subtitle="Manage your categories, services, pricing, and payment policies."
      />
      
      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-500" /></div>
      ) : (
        <div className="flex gap-6">
          {/* Categories Sidebar */}
          <div className="w-1/3 border border-stroke dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 border-b border-stroke dark:border-slate-700 font-bold text-sm flex justify-between items-center">
              <span>Categories</span>
              <button 
                onClick={() => setEditingCategory({ name: "", slug: "", desc: "", rating: "4.5", jobs: "1K+", image: "" })}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-col max-h-[500px] overflow-y-auto">
              {categories.map(c => (
                <div
                  key={c.id}
                  className={`flex justify-between items-center border-b border-stroke dark:border-slate-800 transition-colors ${selectedCategory?.id === c.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <button
                    onClick={() => setSelectedCategory(c)}
                    className={`flex-1 p-4 text-left text-sm font-medium transition-colors ${selectedCategory?.id === c.id ? 'text-indigo-700 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    {c.name}
                  </button>
                  <div className="flex gap-1 pr-3 flex-shrink-0">
                    <button 
                      onClick={() => setEditingCategory(c)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCategory(c.id)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-red-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Services List */}
          <div className="w-2/3 border border-stroke dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 border-b border-stroke dark:border-slate-700 flex justify-between items-center">
              <span className="font-bold text-sm">{selectedCategory?.name} Services</span>
              <Button size="sm" disabled={!selectedCategory} onClick={() => setEditingService({ name: "", price: "", payment_policy: "BOTH", image: "", category: selectedCategory?.id })}>
                <Plus size={14} className="mr-1" /> Add Service
              </Button>
            </div>
            <div className="flex-1 max-h-[500px] overflow-y-auto p-4 space-y-3">
              {services.length === 0 && (
                <div className="text-center p-10 text-slate-500 text-sm">No services found in this category.</div>
              )}
              {services.map(s => (
                <div key={s.id} className="border border-stroke dark:border-slate-700 p-4 rounded-lg flex items-center justify-between hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-colors">
                  <div className="flex items-center gap-4">
                    {s.image ? (
                      <img src={s.image} alt={s.name} className="w-12 h-12 rounded-lg object-cover shadow-sm border border-slate-200 dark:border-slate-700 flex-shrink-0" onError={e => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=100&q=80&fit=crop" }} />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex-shrink-0 flex flex-col items-center justify-center text-slate-400">
                        <span className="text-[9px] font-bold tracking-wider">NO IMG</span>
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm">{s.name}</h4>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                        <span>₹{s.price}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold tracking-wider">
                          {s.payment_policy === 'ONLINE_ONLY' ? 'ONLINE ONLY' : s.payment_policy === 'COD_ONLY' ? 'COD ONLY' : 'ONLINE + COD'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditingService(s)}>
                    <Edit2 size={16} className="text-slate-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <Modal onClose={() => setEditingService(null)} title={editingService.id ? "Edit Service" : "New Service"}>
          <form onSubmit={handleSaveService} className="flex flex-col gap-4">
            <Input 
              label="Service Name" 
              value={editingService.name || ""} 
              onChange={e => setEditingService({...editingService, name: e.target.value})} 
              required
            />
            <Input 
              label="Price (₹)" 
              type="number" 
              value={editingService.price || ""} 
              onChange={e => setEditingService({...editingService, price: e.target.value})} 
              required
            />
            <Input 
              label="Duration (e.g. 1 hr)" 
              value={editingService.duration || ""} 
              onChange={e => setEditingService({...editingService, duration: e.target.value})} 
            />
            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Image Customization</label>
              <div className="flex items-center gap-4">
                {editingService.image && (
                  <div className="flex flex-col gap-1">
                    <img 
                      src={editingService.image} 
                      alt="Preview" 
                      className="w-16 h-16 rounded-lg object-cover shadow-sm border border-slate-200 dark:border-slate-800" 
                      onError={e => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=100&q=80&fit=crop" }}
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      showToast("Uploading image...", "info");
                      const formData = new FormData();
                      formData.append("image", file);
                      try {
                        const res = await apiRequest("/settings/catalog/upload-image/", {
                          method: "POST",
                          body: formData
                        });
                        if (res.success) {
                          setEditingService({...editingService, image: res.url});
                          showToast("Image uploaded successfully!", "success");
                        } else {
                          showToast(res.message || "Failed to upload image", "error");
                        }
                      } catch (err) {
                        showToast("Error uploading image", "error");
                      }
                    }}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 dark:file:bg-indigo-900/30 dark:file:text-indigo-400 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/50 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">Upload a custom image. It will instantly reflect on the booking page.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Policy</label>
              <select 
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={editingService.payment_policy}
                onChange={e => setEditingService({...editingService, payment_policy: e.target.value})}
              >
                <option value="BOTH">Online + COD (BOTH)</option>
                <option value="ONLINE_ONLY">Online Only (ONLINE_ONLY)</option>
                <option value="COD_ONLY">COD Only (COD_ONLY)</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <Button type="button" variant="ghost" onClick={() => setEditingService(null)}>Cancel</Button>
              <Button type="submit">Save Service</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <Modal onClose={() => setEditingCategory(null)} title={editingCategory.id ? "Edit Category" : "New Category"}>
          <form onSubmit={handleSaveCategory} className="flex flex-col gap-4">
            <Input 
              label="Category Name" 
              value={editingCategory.name || ""} 
              onChange={e => setEditingCategory({...editingCategory, name: e.target.value})} 
              required
            />
            <Input 
              label="Slug (URL identifier)" 
              value={editingCategory.slug || ""} 
              onChange={e => setEditingCategory({...editingCategory, slug: e.target.value})} 
              placeholder="e.g. air-conditioning (optional)"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
              <textarea 
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={editingCategory.desc || ""} 
                onChange={e => setEditingCategory({...editingCategory, desc: e.target.value})} 
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Rating (e.g. 4.8)" 
                value={editingCategory.rating || ""} 
                onChange={e => setEditingCategory({...editingCategory, rating: e.target.value})} 
              />
              <Input 
                label="Jobs Completed (e.g. 10K+)" 
                value={editingCategory.jobs || ""} 
                onChange={e => setEditingCategory({...editingCategory, jobs: e.target.value})} 
              />
            </div>
            
            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category Image</label>
              <div className="flex items-center gap-4">
                {editingCategory.image && (
                  <div className="flex flex-col gap-1">
                    <img 
                      src={editingCategory.image} 
                      alt="Preview" 
                      className="w-16 h-16 rounded-lg object-cover shadow-sm border border-slate-200 dark:border-slate-800" 
                      onError={e => { e.target.onerror = null; e.target.src = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=100&q=80&fit=crop" }}
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      showToast("Uploading image...", "info");
                      const formData = new FormData();
                      formData.append("image", file);
                      try {
                        const res = await apiRequest("/settings/catalog/upload-image/", {
                          method: "POST",
                          body: formData
                        });
                        if (res.success) {
                          setEditingCategory({...editingCategory, image: res.url});
                          showToast("Image uploaded successfully!", "success");
                        } else {
                          showToast(res.message || "Failed to upload image", "error");
                        }
                      } catch (err) {
                        showToast("Error uploading image", "error");
                      }
                    }}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 dark:file:bg-indigo-900/30 dark:file:text-indigo-400 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/50 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">Upload a custom image for the category. It will instantly reflect on the booking homepage.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-4">
              <Button type="button" variant="ghost" onClick={() => setEditingCategory(null)}>Cancel</Button>
              <Button type="submit">Save Category</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
