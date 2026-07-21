import os

path = r"c:\Users\user\Caltrackk\Caltrack\frontend\src\ui\pages\BookingPage.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add BOOKING_CURRENCY_SYMBOL declaration
import_marker = 'import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";'
declaration = '\n\nlet BOOKING_CURRENCY_SYMBOL = "₹";'
if declaration not in content:
    content = content.replace(import_marker, import_marker + declaration)

# 2. Update loadCatalog to set symbol
old_catalog = """        if (svcRes.success) {
          const pkgs = {}"""
new_catalog = """        if (svcRes.success) {
          if (svcRes.currency_symbol) {
            BOOKING_CURRENCY_SYMBOL = svcRes.currency_symbol;
          }
          const pkgs = {}"""
content = content.replace(old_catalog, new_catalog)

# 3. Update StepPackage packages map
old_step_pkg = '  const packages = (packagesData && packagesData[category?.id]) || PACKAGES[category?.id] || []'
new_step_pkg = '  const packages = ((packagesData && packagesData[category?.id]) || PACKAGES[category?.id] || []).map(p => ({ ...p, priceStr: BOOKING_CURRENCY_SYMBOL + p.price }))'
content = content.replace(old_step_pkg, new_step_pkg)

# 4. Update Category services map in loadCatalog (line 2510)
old_price_str = 'priceStr: "₹" + s.price,'
new_price_str = 'priceStr: BOOKING_CURRENCY_SYMBOL + s.price,'
content = content.replace(old_price_str, new_price_str)

# 5. Update other hardcoded rupee symbols
content = content.replace('· ₹{totalPrice}', '· {BOOKING_CURRENCY_SYMBOL}{totalPrice}')
content = content.replace('<span>₹{c.price * c.quantity}</span>', '<span>{BOOKING_CURRENCY_SYMBOL}{c.price * c.quantity}</span>')
content = content.replace('<span>₹{totalPrice}</span>', '<span>{BOOKING_CURRENCY_SYMBOL}{totalPrice}</span>')
content = content.replace("₹{total.toLocaleString('en-IN')}", "{BOOKING_CURRENCY_SYMBOL}{total.toLocaleString()}")
content = content.replace("₹{total.toLocaleString()}", "{BOOKING_CURRENCY_SYMBOL}{total.toLocaleString()}")
content = content.replace('₹{c.price * c.quantity}</div>', '{BOOKING_CURRENCY_SYMBOL}{c.price * c.quantity}</div>')
content = content.replace('Total Price : ₹{cart.reduce', 'Total Price : {BOOKING_CURRENCY_SYMBOL}{cart.reduce')
content = content.replace('priceStr: "₹" + cart.reduce', 'priceStr: BOOKING_CURRENCY_SYMBOL + cart.reduce')
content = content.replace('value: `₹${totalPrice}`', 'value: `${BOOKING_CURRENCY_SYMBOL}${totalPrice}`')
content = content.replace('saved ₹100', 'saved {BOOKING_CURRENCY_SYMBOL}100')
content = content.replace('amount: "₹899"', 'amount: BOOKING_CURRENCY_SYMBOL + "899"')
content = content.replace('amount: "₹2,499"', 'amount: BOOKING_CURRENCY_SYMBOL + "2,499"')
content = content.replace("s.priceStr || '₹499'", "s.priceStr || (BOOKING_CURRENCY_SYMBOL + '499')")
content = content.replace('className="uc-cart-bar-price">₹{cart.reduce', 'className="uc-cart-bar-price">{BOOKING_CURRENCY_SYMBOL}{cart.reduce')

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS")
