export const TECHNICIAN_ROLES = [
  { id: "ac_technician", label: "AC Technician" },
  { id: "appliance_technician", label: "Appliance Technician" },
  { id: "carpenter", label: "Carpenter" },
  { id: "electrician", label: "Electrician" },
  { id: "handyman", label: "Handyman Technician" },
  { id: "cleaning", label: "Cleaning Technician" },
  { id: "painter", label: "Painter" },
  { id: "pest_control", label: "Pest Control Technician" },
  { id: "plumber", label: "Plumber" },
  { id: "security", label: "Security System Technician" }
]

export const ROLE_TO_CATEGORY_MAP = {
  "ac_technician": ["hvac"],
  "appliance_technician": ["appliance_repair"],
  "carpenter": ["carpentry"],
  "electrician": ["electrical"],
  "handyman": ["general"],
  "cleaning": ["cleaning"],
  "painter": ["painting"],
  "pest_control": ["pest_control"],
  "plumber": ["plumbing"],
  "security": ["security"]
}

export const CATEGORY_TO_ROLES_MAP = {}
Object.keys(ROLE_TO_CATEGORY_MAP).forEach(role => {
  ROLE_TO_CATEGORY_MAP[role].forEach(cat => {
    if (!CATEGORY_TO_ROLES_MAP[cat]) CATEGORY_TO_ROLES_MAP[cat] = []
    if (!CATEGORY_TO_ROLES_MAP[cat].includes(role)) {
      CATEGORY_TO_ROLES_MAP[cat].push(role)
    }
  })
})
