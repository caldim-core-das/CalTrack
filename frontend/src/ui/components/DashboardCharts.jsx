import React from "react"
import { Bar, Line, Doughnut } from "react-chartjs-2"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from "chart.js"

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

export function BarChart({ data, options }) {
  const mergedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    ...options
  }
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Bar data={data} options={mergedOptions} />
    </div>
  )
}

export function LineChart({ data, options }) {
  const mergedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    ...options
  }
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Line data={data} options={mergedOptions} />
    </div>
  )
}

export function DoughnutChart({ data, options }) {
  const mergedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    ...options
  }
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Doughnut data={data} options={mergedOptions} />
    </div>
  )
}
