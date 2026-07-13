import { configureStore } from "@reduxjs/toolkit"
import liveLocationReducer from "./liveLocationSlice.js"
import inventoryReducer from "./inventorySlice.js"
import mileageReducer from "./mileageSlice.js"
import trialReducer from "./trialSlice.js"

export const store = configureStore({
  reducer: {
    liveLocation: liveLocationReducer,
    inventory: inventoryReducer,
    mileage: mileageReducer,
    trial: trialReducer,
  },
})
