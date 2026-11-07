import React from "react"
import Root from "../Root"

export type AppRoute = "/" | "/login" | "/register" | "/app"

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  APP: "/app",
} as const

export function AppRouter() {
  return <Root />
}

export default AppRouter
