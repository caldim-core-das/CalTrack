/**
 * Utility for browser notifications (Web Notifications API)
 */

export const NotificationService = {
    /**
     * Request permission from the user
     */
    async requestPermission() {
        if (!("Notification" in window)) {
            console.warn("This browser does not support desktop notifications")
            return false
        }

        if (Notification.permission === "granted") return true

        if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission()
            return permission === "granted"
        }

        return false
    },

    /**
     * Send a notification
     */
    async send(title, body, options = {}) {
        const hasPermission = await this.requestPermission()
        if (!hasPermission) return null

        const defaultOptions = {
            icon: "/logo192.png", // Fallback to a default icon
            badge: "/logo192.png",
            silent: false,
            ...options
        }

        try {
            const n = new Notification(title, { body, ...defaultOptions })
            n.onclick = () => {
                window.focus()
                n.close()
                if (options.onClick) options.onClick()
            }
            return n
        } catch (err) {
            console.error("Failed to send notification:", err)
            return null
        }
    },

    /**
     * Specific reminder for clocking out
     */
    sendClockOutReminder() {
        this.send("Forget to clock out today?", "QuickTIMS has your arrival time saved.", {
            tag: "clock-out-reminder",
            requireInteraction: true, // Keep it visible until dismissed
        })
    }
}
