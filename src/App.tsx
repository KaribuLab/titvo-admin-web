import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ConfigListPage } from './pages/ConfigListPage'
import { ConfigFormPage } from './pages/ConfigFormPage'
import { RepoListPage } from './pages/RepoListPage'
import { ScanDetailPage } from './pages/ScanDetailPage'
import { ApiKeyListPage } from './pages/ApiKeyListPage'
import { ApiKeyCreatePage } from './pages/ApiKeyCreatePage'
import { UserListPage } from './pages/UserListPage'
import { UserCreatePage } from './pages/UserCreatePage'

export function App (): React.ReactElement {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/config" element={<ConfigListPage />} />
            <Route path="/config/new" element={<ConfigFormPage />} />
            <Route path="/config/:parameterId/edit" element={<ConfigFormPage />} />
            <Route path="/repos" element={<RepoListPage />} />
            <Route path="/scans/:scanId" element={<ScanDetailPage />} />
            <Route path="/api-keys" element={<ApiKeyListPage />} />
            <Route path="/api-keys/new" element={<ApiKeyCreatePage />} />
            <Route path="/users" element={<UserListPage />} />
            <Route path="/users/new" element={<UserCreatePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
