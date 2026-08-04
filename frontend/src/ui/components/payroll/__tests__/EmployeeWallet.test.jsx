import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { PeriodFilter } from "../PeriodFilter.jsx"
import { PayoutCard } from "../PayoutCard.jsx"

describe("Employee Wallet Components", () => {
  test("PeriodFilter click triggers onChange handler with right period value", () => {
    const handleChange = jest.fn()
    render(<PeriodFilter value="month" onChange={handleChange} />)

    const todayBtn = screen.getByTestId("period-filter-today")
    fireEvent.click(todayBtn)

    expect(handleChange).toHaveBeenCalledWith("today")
  })

  test("PayoutCard renders disabled download button when status is PENDING or REVERSED, enabled when CREDITED", () => {
    const handleDownload = jest.fn()

    // Test PENDING
    const { rerender } = render(
      <PayoutCard
        transaction={{ id: 101, status: "PENDING", gross_amount: "1000", net_credit_amount: "800" }}
        onDownloadPayslip={handleDownload}
      />
    )
    const pendingBtn = screen.getByTestId("payslip-btn-101")
    expect(pendingBtn).toBeDisabled()
    expect(pendingBtn).toHaveAttribute("title", "Available once credited")

    // Test REVERSED
    rerender(
      <PayoutCard
        transaction={{ id: 102, status: "REVERSED", gross_amount: "1000", net_credit_amount: "0" }}
        onDownloadPayslip={handleDownload}
      />
    )
    const reversedBtn = screen.getByTestId("payslip-btn-102")
    expect(reversedBtn).toBeDisabled()
    expect(reversedBtn).toHaveAttribute("title", "Reversed — no payslip")

    // Test CREDITED
    rerender(
      <PayoutCard
        transaction={{ id: 103, status: "CREDITED", gross_amount: "1000", net_credit_amount: "800" }}
        onDownloadPayslip={handleDownload}
      />
    )
    const creditedBtn = screen.getByTestId("payslip-btn-103")
    expect(creditedBtn).not.toBeDisabled()
    fireEvent.click(creditedBtn)
    expect(handleDownload).toHaveBeenCalledWith(
      expect.objectContaining({ id: 103, status: "CREDITED" })
    )
  })
})
