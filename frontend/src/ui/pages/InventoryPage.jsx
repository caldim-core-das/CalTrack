import { useEffect, useState, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  fetchInventoryItems,
  fetchInventoryIssuances,
  fetchMyItems,
  fetchAlerts,
  clearInventoryState
} from "../../store/inventorySlice.js"
import { Package, AlertCircle, CheckCircle, Search, User, ClipboardList, MapPin, Plus, X, Trash2 } from "lucide-react"
import { useRole } from "../../state/auth/useRole.js"
import { apiRequest, unwrapResults } from "../../api/client.js"

export function InventoryPage() {
  const dispatch = useDispatch()
  const { isAdmin } = useRole()
  
  const [activeTab, setActiveTab] = useState(isAdmin ? "stock" : "my_items")
  const { items, issuances, myItems, alerts, loading } = useSelector((state) => state.inventory)

  const [searchQuery, setSearchQuery] = useState("")

  // Add Stock Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [locations, setLocations] = useState([])
  const [addItemForm, setAddItemForm] = useState({
    name: "",
    category: "ppe",
    sku: "",
    location: "",
    total_quantity: 1,
    reorder_threshold: 1,
    unit_cost: 0.0,
    is_returnable: true,
    requires_photo_on_issue: false
  })

  const [employees, setEmployees] = useState([])
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [selectedIssuance, setSelectedIssuance] = useState(null)
  const [returnForm, setReturnForm] = useState({
    condition_on_return: "good",
    notes: ""
  })

  // Issuance Form State
  const [issueForm, setIssueForm] = useState({
    item_id: "",
    employee_id: "",
    quantity: 1,
    expected_return_date: "",
    condition_on_issue: "good",
    notes: ""
  })

  useEffect(() => {
    if (isAdmin) {
      dispatch(fetchInventoryItems())
      dispatch(fetchInventoryIssuances())
      dispatch(fetchAlerts())

      // Load locations and employees for issue tracking
      const loadMetadata = async () => {
        try {
          const [locRes, empRes] = await Promise.all([
            apiRequest("/time/locations/"),
            apiRequest("/employees/")
          ])
          setLocations(unwrapResults(locRes))
          setEmployees(unwrapResults(empRes))
        } catch (err) {
          console.error("Failed to load metadata", err)
        }
      }
      loadMetadata()
    }
    dispatch(fetchMyItems())

    return () => {
      dispatch(clearInventoryState())
    }
  }, [dispatch, isAdmin])

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [items, searchQuery])

  const handleAddItem = async (e) => {
    e.preventDefault()
    try {
      await apiRequest("/inventory/items/", {
        method: "POST",
        json: {
          name: addItemForm.name,
          category: addItemForm.category,
          sku: addItemForm.sku,
          location: addItemForm.location ? parseInt(addItemForm.location) : null,
          total_quantity: parseInt(addItemForm.total_quantity),
          reorder_threshold: parseInt(addItemForm.reorder_threshold),
          unit_cost: parseFloat(addItemForm.unit_cost),
          is_returnable: addItemForm.is_returnable,
          requires_photo_on_issue: addItemForm.requires_photo_on_issue
        }
      })
      alert("Stock item added successfully")
      dispatch(fetchInventoryItems())
      setShowAddModal(false)
      setAddItemForm({
        name: "",
        category: "ppe",
        sku: "",
        location: "",
        total_quantity: 1,
        reorder_threshold: 1,
        unit_cost: 0.0,
        is_returnable: true,
        requires_photo_on_issue: false
      })
    } catch (err) {
      alert("Error adding item: " + (err.body?.message || err.message || JSON.stringify(err)))
    }
  }

  const handleIssueItem = async (e) => {
    e.preventDefault()
    try {
      await apiRequest("/inventory/issuances/", {
        method: "POST",
        json: {
          item: parseInt(issueForm.item_id),
          employee: parseInt(issueForm.employee_id),
          quantity: parseInt(issueForm.quantity),
          expected_return_date: issueForm.expected_return_date || null,
          condition_on_issue: issueForm.condition_on_issue,
          notes: issueForm.notes
        }
      })
      alert("Item issued successfully")
      dispatch(fetchInventoryIssuances())
      dispatch(fetchInventoryItems())
      setIssueForm({ item_id: "", employee_id: "", quantity: 1, expected_return_date: "", condition_on_issue: "good", notes: "" })
    } catch (err) {
      alert("Error issuing item: " + (err.body?.message || err.message || JSON.stringify(err)))
    }
  }

  const handleOpenReturnModal = (issuance) => {
    setSelectedIssuance(issuance)
    setReturnForm({
      condition_on_return: "good",
      notes: ""
    })
    setShowReturnModal(true)
  }

  const handleReturnItemSubmit = async (e) => {
    e.preventDefault()
    if (!selectedIssuance) return
    try {
      await apiRequest(`/inventory/issuances/${selectedIssuance.id}/return_item/`, {
        method: "PATCH",
        json: {
          condition_on_return: returnForm.condition_on_return,
          notes: returnForm.notes
        }
      })
      alert("Item returned successfully")
      dispatch(fetchInventoryIssuances())
      dispatch(fetchInventoryItems())
      setShowReturnModal(false)
      setSelectedIssuance(null)
      setReturnForm({ condition_on_return: "good", notes: "" })
    } catch (err) {
      alert("Error returning item: " + (err.body?.message || err.message || JSON.stringify(err)))
    }
  }

  const handleResolveAlert = async (alertId) => {
    try {
      await apiRequest(`/inventory/alerts/${alertId}/resolve/`, {
        method: "PATCH",
        json: {}
      })
      dispatch(fetchAlerts())
    } catch (err) {
      alert("Error resolving alert: " + (err.body?.message || err.message || JSON.stringify(err)))
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to delete this stock item? This action cannot be undone.")) {
      return
    }
    try {
      await apiRequest(`/inventory/items/${itemId}/`, {
        method: "DELETE"
      })
      alert("Item deleted successfully")
      dispatch(fetchInventoryItems())
      dispatch(fetchAlerts())
    } catch (err) {
      alert("Error deleting item: " + (err.body?.message || err.message || JSON.stringify(err)))
    }
  }

  return (
    <>
      <div style={{ padding: "24px", animation: "fadeUp 0.4s ease both", display: "flex", flexDirection: "column", gap: "24px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Package size={28} color="var(--primary, #ec4899)" />
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "var(--fg, #111)" }}>Inventory Management</h1>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--stroke2, #e5e7eb)", paddingBottom: "12px" }}>
        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab("stock")}
              style={{
                padding: "8px 16px",
                border: "none",
                background: activeTab === "stock" ? "var(--primary, #ec4899)" : "transparent",
                color: activeTab === "stock" ? "#fff" : "var(--muted, #6b7280)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Stock
            </button>
            <button
              onClick={() => setActiveTab("issuances")}
              style={{
                padding: "8px 16px",
                border: "none",
                background: activeTab === "issuances" ? "var(--primary, #ec4899)" : "transparent",
                color: activeTab === "issuances" ? "#fff" : "var(--muted, #6b7280)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Issuances
            </button>
            <button
              onClick={() => setActiveTab("alerts")}
              style={{
                padding: "8px 16px",
                border: "none",
                background: activeTab === "alerts" ? "var(--primary, #ec4899)" : "transparent",
                color: activeTab === "alerts" ? "#fff" : "var(--muted, #6b7280)",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Alerts {alerts.length > 0 && `(${alerts.length})`}
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab("my_items")}
          style={{
            padding: "8px 16px",
            border: "none",
            background: activeTab === "my_items" ? "var(--primary, #ec4899)" : "transparent",
            color: activeTab === "my_items" ? "#fff" : "var(--muted, #6b7280)",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          My Items
        </button>
      </div>

      {loading && <p style={{ color: "var(--muted, #6b7280)" }}>Loading...</p>}

      {/* Stock Tab */}
      {!loading && activeTab === "stock" && isAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface, #fff)", padding: "12px", borderRadius: "8px", border: "1px solid var(--stroke, #e5e7eb)", flex: 1 }}>
              <Search size={18} color="var(--muted, #6b7280)" />
              <input 
                type="text" 
                placeholder="Search inventory..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", width: "100%", background: "transparent", color: "var(--fg, #111)" }}
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                background: "var(--primary, #ec4899)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(236,72,153,0.2)"
              }}
            >
              <Plus size={16} /> Add Stock Item
            </button>
          </div>
          
          <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface, #fff)", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--stroke, #e5e7eb)" }}>
            <thead style={{ background: "var(--stroke2, #f9fafb)", textAlign: "left", color: "var(--muted, #6b7280)", fontSize: "14px" }}>
              <tr>
                <th style={{ padding: "12px" }}>Item Name</th>
                <th style={{ padding: "12px" }}>SKU</th>
                <th style={{ padding: "12px" }}>Category</th>
                <th style={{ padding: "12px" }}>Location</th>
                <th style={{ padding: "12px" }}>Total</th>
                <th style={{ padding: "12px" }}>Available</th>
                <th style={{ padding: "12px" }}>Status</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} style={{ borderTop: "1px solid var(--stroke, #e5e7eb)" }}>
                  <td style={{ padding: "12px", color: "var(--fg, #111)", fontWeight: "500" }}>{item.name}</td>
                  <td style={{ padding: "12px", color: "var(--muted, #6b7280)" }}>{item.sku || "-"}</td>
                  <td style={{ padding: "12px", color: "var(--muted, #6b7280)" }}>{item.category}</td>
                  <td style={{ padding: "12px", color: "var(--muted, #6b7280)" }}>{item.location_name || "Unassigned"}</td>
                  <td style={{ padding: "12px", color: "var(--fg, #111)" }}>{item.total_quantity}</td>
                  <td style={{ padding: "12px", color: "var(--fg, #111)" }}>{item.available_quantity}</td>
                  <td style={{ padding: "12px" }}>
                    {item.available_quantity <= item.reorder_threshold ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "var(--danger-light, #fee2e2)", color: "var(--danger, #ef4444)", padding: "4px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" }}>
                        <AlertCircle size={14} /> Reorder
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "var(--success-light, #d1fae5)", color: "var(--success, #10b981)", padding: "4px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" }}>
                        <CheckCircle size={14} /> OK
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      title="Delete Item"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--danger, #ef4444)",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: "6px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background-color 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--danger-light, #fee2e2)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "var(--muted, #6b7280)" }}>No items found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Issuances Tab */}
      {!loading && activeTab === "issuances" && isAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ background: "var(--surface, #fff)", padding: "24px", borderRadius: "8px", border: "1px solid var(--stroke, #e5e7eb)" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", color: "var(--fg, #111)" }}>Issue Item</h2>
            <form onSubmit={handleIssueItem} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Select Item</label>
                <select 
                  required
                  value={issueForm.item_id}
                  onChange={e => setIssueForm({...issueForm, item_id: e.target.value})}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)", width: "100%", boxSizing: "border-box" }}
                >
                  <option value="">-- Choose Item --</option>
                  {items.filter(i => i.available_quantity > 0).map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Available: {i.available_quantity})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Select Employee</label>
                <select 
                  required
                  value={issueForm.employee_id}
                  onChange={e => setIssueForm({...issueForm, employee_id: e.target.value})}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)", width: "100%", boxSizing: "border-box" }}
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.employee_id} - {emp.user?.first_name} {emp.user?.last_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Quantity</label>
                <input 
                  type="number"
                  required
                  min="1"
                  value={issueForm.quantity}
                  onChange={e => setIssueForm({...issueForm, quantity: e.target.value})}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)", width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Expected Return Date</label>
                <input 
                  type="date"
                  value={issueForm.expected_return_date}
                  onChange={e => setIssueForm({...issueForm, expected_return_date: e.target.value})}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)", width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Condition on Issue</label>
                <select 
                  required
                  value={issueForm.condition_on_issue}
                  onChange={e => setIssueForm({...issueForm, condition_on_issue: e.target.value})}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)", width: "100%", boxSizing: "border-box" }}
                >
                  <option value="new">New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="damaged">Damaged</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Notes (Optional)</label>
                <input 
                  type="text"
                  placeholder="e.g. check out notes"
                  value={issueForm.notes}
                  onChange={e => setIssueForm({...issueForm, notes: e.target.value})}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)", width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <button type="submit" style={{ padding: "10px 24px", background: "var(--primary, #ec4899)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", height: "42px", width: "100%" }}>
                Issue Item
              </button>
            </form>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--surface, #fff)", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--stroke, #e5e7eb)" }}>
            <thead style={{ background: "var(--stroke2, #f9fafb)", textAlign: "left", color: "var(--muted, #6b7280)", fontSize: "14px" }}>
              <tr>
                <th style={{ padding: "12px" }}>Item</th>
                <th style={{ padding: "12px" }}>Employee</th>
                <th style={{ padding: "12px" }}>Quantity</th>
                <th style={{ padding: "12px" }}>Issued At</th>
                <th style={{ padding: "12px" }}>Expected Return</th>
                <th style={{ padding: "12px" }}>Condition</th>
                <th style={{ padding: "12px" }}>Status</th>
                <th style={{ padding: "12px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {issuances.map(issuance => {
                const isOverdue = !issuance.returned_at && issuance.expected_return_date && new Date(issuance.expected_return_date) < new Date();
                return (
                  <tr key={issuance.id} style={{ borderTop: "1px solid var(--stroke, #e5e7eb)" }}>
                    <td style={{ padding: "12px", color: "var(--fg, #111)", fontWeight: "500" }}>{issuance.item_name}</td>
                    <td style={{ padding: "12px", color: "var(--fg, #111)" }}>{issuance.employee_name}</td>
                    <td style={{ padding: "12px", color: "var(--fg, #111)" }}>{issuance.quantity}</td>
                    <td style={{ padding: "12px", color: "var(--muted, #6b7280)" }}>{new Date(issuance.issued_at).toLocaleDateString()}</td>
                    <td style={{ padding: "12px", color: isOverdue ? "var(--danger, #ef4444)" : "var(--muted, #6b7280)", fontWeight: isOverdue ? "bold" : "normal" }}>
                      {issuance.expected_return_date ? new Date(issuance.expected_return_date).toLocaleDateString() : "-"}
                    </td>
                    <td style={{ padding: "12px", textTransform: "capitalize" }}>
                      <span style={{ 
                        display: "inline-flex", 
                        padding: "2px 6px", 
                        borderRadius: "4px", 
                        fontSize: "12px", 
                        fontWeight: "500",
                        background: issuance.condition_on_issue === "new" || issuance.condition_on_issue === "good" ? "var(--success-light, #d1fae5)" : "var(--warning-light, #fef3c7)",
                        color: issuance.condition_on_issue === "new" || issuance.condition_on_issue === "good" ? "var(--success, #10b981)" : "var(--warning, #f59e0b)"
                      }}>
                        {issuance.condition_on_issue}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      {issuance.returned_at ? (
                        <span style={{ color: "var(--success, #10b981)", fontWeight: "500" }}>Returned</span>
                      ) : isOverdue ? (
                        <span style={{ color: "var(--danger, #ef4444)", fontWeight: "bold" }}>Overdue</span>
                      ) : (
                        <span style={{ color: "var(--warning, #f59e0b)", fontWeight: "500" }}>Issued</span>
                      )}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      {!issuance.returned_at && (
                        <button 
                          onClick={() => handleOpenReturnModal(issuance)}
                          style={{ padding: "6px 12px", background: "transparent", color: "var(--primary, #ec4899)", border: "1px solid var(--primary, #ec4899)", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                        >
                          Return
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {issuances.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "var(--muted, #6b7280)" }}>No issuances found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* My Items Tab */}
      {!loading && activeTab === "my_items" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {myItems.map(issuance => (
            <div key={issuance.id} style={{ background: "var(--surface, #fff)", padding: "20px", borderRadius: "12px", border: "1px solid var(--stroke, #e5e7eb)", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "var(--primary-light, #e0e7ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary, #ec4899)" }}>
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", color: "var(--fg, #111)" }}>{issuance.item_name}</h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--muted, #6b7280)" }}>Qty: {issuance.quantity}</p>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "var(--muted, #6b7280)" }}>
                <span><strong>Issued on:</strong> {new Date(issuance.issued_at).toLocaleDateString()}</span>
                {issuance.expected_return_date && <span><strong>Expected return:</strong> {new Date(issuance.expected_return_date).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
          {myItems.length === 0 && (
            <div style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center", color: "var(--muted, #6b7280)", background: "var(--surface, #fff)", borderRadius: "12px", border: "1px solid var(--stroke, #e5e7eb)" }}>
              <Package size={48} opacity={0.5} style={{ margin: "0 auto 16px auto" }} />
              <p style={{ margin: 0, fontSize: "16px" }}>You have no items issued to you.</p>
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {!loading && activeTab === "alerts" && isAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "var(--danger-light, #fee2e2)", border: "1px solid var(--danger, #ef4444)", borderRadius: "8px", color: "var(--danger-dark, #991b1b)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <AlertCircle size={24} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: "bold" }}>{alert.alert_type.replace('_', ' ').toUpperCase()} - {alert.item_name}</span>
                  <span style={{ fontSize: "14px" }}>{alert.message}</span>
                </div>
              </div>
              <button 
                onClick={() => handleResolveAlert(alert.id)}
                style={{ padding: "8px 16px", background: "var(--danger, #ef4444)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
              >
                Resolve
              </button>
            </div>
          ))}
          {alerts.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted, #6b7280)", background: "var(--surface, #fff)", borderRadius: "12px", border: "1px solid var(--stroke, #e5e7eb)" }}>
              <CheckCircle size={48} opacity={0.5} style={{ margin: "0 auto 16px auto", color: "var(--success, #10b981)" }} />
              <p style={{ margin: 0, fontSize: "16px" }}>No active alerts. All good!</p>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Add Stock Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}>
          <form onSubmit={handleAddItem} style={{
            background: "var(--surface, #fff)",
            width: "100%",
            maxWidth: "500px",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
            border: "1px solid var(--stroke, #e5e7eb)",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "var(--fg, #111)", fontWeight: "bold" }}>Add New Stock Item</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", color: "var(--muted, #6b7280)", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Item Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Safety Harness"
                value={addItemForm.name}
                onChange={e => setAddItemForm({...addItemForm, name: e.target.value})}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>SKU (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SAF-HARN-01"
                  value={addItemForm.sku}
                  onChange={e => setAddItemForm({...addItemForm, sku: e.target.value})}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Category</label>
                <select
                  required
                  value={addItemForm.category}
                  onChange={e => setAddItemForm({...addItemForm, category: e.target.value})}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)" }}
                >
                  <option value="equipment">Equipment</option>
                  <option value="consumable">Consumable</option>
                  <option value="uniform">Uniform</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="ppe">PPE</option>
                  <option value="tool">Tool</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Location</label>
              <select
                required
                value={addItemForm.location}
                onChange={e => setAddItemForm({...addItemForm, location: e.target.value})}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)" }}
              >
                <option value="">-- Select Depot/Location --</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Total Quantity</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={addItemForm.total_quantity}
                  onChange={e => setAddItemForm({...addItemForm, total_quantity: e.target.value})}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Alert Threshold</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={addItemForm.reorder_threshold}
                  onChange={e => setAddItemForm({...addItemForm, reorder_threshold: e.target.value})}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Unit Cost ($)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={addItemForm.unit_cost}
                  onChange={e => setAddItemForm({...addItemForm, unit_cost: e.target.value})}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "24px", marginTop: "8px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--fg, #111)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={addItemForm.is_returnable}
                  onChange={e => setAddItemForm({...addItemForm, is_returnable: e.target.checked})}
                  style={{ accentColor: "var(--primary, #ec4899)", width: "16px", height: "16px" }}
                />
                Is Returnable
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--fg, #111)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={addItemForm.requires_photo_on_issue}
                  onChange={e => setAddItemForm({...addItemForm, requires_photo_on_issue: e.target.checked})}
                  style={{ accentColor: "var(--primary, #ec4899)", width: "16px", height: "16px" }}
                />
                Require Photo Proof
              </label>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ padding: "10px 20px", borderRadius: "8px", background: "transparent", border: "1px solid var(--stroke, #e5e7eb)", color: "var(--muted, #6b7280)", fontWeight: "bold", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: "10px 24px", borderRadius: "8px", background: "var(--primary, #ec4899)", border: "none", color: "#fff", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 12px rgba(236,72,153,0.2)" }}
              >
                Add Item
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Return Item Modal */}
      {showReturnModal && selectedIssuance && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}>
          <form onSubmit={handleReturnItemSubmit} style={{
            background: "var(--surface, #fff)",
            width: "100%",
            maxWidth: "500px",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
            border: "1px solid var(--stroke, #e5e7eb)",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "var(--fg, #111)", fontWeight: "bold" }}>Return Stock Item</h3>
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false)
                  setSelectedIssuance(null)
                }}
                style={{ background: "none", border: "none", color: "var(--muted, #6b7280)", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "12px", background: "var(--stroke2, #f9fafb)", borderRadius: "8px", fontSize: "14px", color: "var(--fg, #111)", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span><strong>Item:</strong> {selectedIssuance.item_name}</span>
              <span><strong>Issued To:</strong> {selectedIssuance.employee_name}</span>
              <span><strong>Quantity:</strong> {selectedIssuance.quantity}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Condition on Return</label>
              <select
                required
                value={returnForm.condition_on_return}
                onChange={e => setReturnForm({...returnForm, condition_on_return: e.target.value})}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)" }}
              >
                <option value="new">New / Unused</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="damaged">Damaged (Will flag for deduction)</option>
              </select>
            </div>

            {returnForm.condition_on_return === "damaged" && (
              <div style={{ padding: "10px 12px", background: "var(--danger-light, #fee2e2)", color: "var(--danger, #ef4444)", borderRadius: "6px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertCircle size={16} />
                <span><strong>Notice:</strong> Marking this item as damaged triggers a safety compliance alert and flags the record for employee payroll deduction.</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "14px", color: "var(--muted, #6b7280)", fontWeight: "500" }}>Return Notes</label>
              <textarea
                placeholder="Describe item condition or reason for return..."
                value={returnForm.notes}
                onChange={e => setReturnForm({...returnForm, notes: e.target.value})}
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px", borderRadius: "6px", border: "1px solid var(--stroke, #e5e7eb)", background: "transparent", color: "var(--fg, #111)", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false)
                  setSelectedIssuance(null)
                }}
                style={{ padding: "10px 20px", borderRadius: "8px", background: "transparent", border: "1px solid var(--stroke, #e5e7eb)", color: "var(--muted, #6b7280)", fontWeight: "bold", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: "10px 24px", borderRadius: "8px", background: "var(--primary, #ec4899)", border: "none", color: "#fff", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 12px rgba(236,72,153,0.2)" }}
              >
                Complete Return
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
