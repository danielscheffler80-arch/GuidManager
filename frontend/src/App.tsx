// Updated App.tsx mit Authentication

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Roster from './pages/Roster';
import Raids from './pages/Raids';
import MythicPlus from './pages/MythicPlus';
import Streams from './pages/Streams';
import StreamSettings from './pages/StreamSettings';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Login from './pages/Login';
import CreateRaid from './pages/CreateRaid';
import AdminSettings from './pages/AdminSettings';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { WebRTCProvider } from './contexts/WebRTCContext';
import { useAuth } from './contexts/AuthContext';
import { GuildProvider } from './contexts/GuildContext';

function AppContent() {
  const { user, isLoading } = useAuth();

  console.log('AppContent Render:', { isLoading, hasUser: !!user });

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#252525',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#D1D9E0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid rgba(163, 48, 201, 0.3)',
            borderTopColor: '#A330C9',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <p style={{ marginTop: '16px' }}>Lade Gilden-Manager...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <Sidebar />
      </aside>
      <div className="main-container">
        <Header />
        <main className="mainframe">
          <Routes>
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/roster" element={
              <ProtectedRoute>
                <Roster />
              </ProtectedRoute>
            } />
            <Route path="/raids" element={
              <ProtectedRoute>
                <Raids />
              </ProtectedRoute>
            } />
            <Route path="/mythic" element={
              <ProtectedRoute>
                <MythicPlus />
              </ProtectedRoute>
            } />
            <Route path="/streams" element={
              <ProtectedRoute>
                <Streams />
              </ProtectedRoute>
            } />
            <Route path="/stream-settings" element={
              <ProtectedRoute>
                <StreamSettings />
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/admin/create-raid" element={
              <ProtectedRoute>
                <CreateRaid />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute>
                <AdminSettings />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <WebRTCProvider>
          <HashRouter>
            <GuildProvider>
              <AppContent />
            </GuildProvider>
          </HashRouter>
        </WebRTCProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}