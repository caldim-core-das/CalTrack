/**
 * formatCurrency.js
 * Shared currency formatter helper using Intl.NumberFormat
 */

export function formatCurrency(amount, currency = "INR") {
  const num = Number(amount || 0)
  const currCode = currency === "₹" || currency === "INR" || !currency ? "INR" : currency
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currCode,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(num)
  } catch {
    return `₹${num.toFixed(2)}`
  }
}
